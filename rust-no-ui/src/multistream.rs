// Copyright 2024 Scaleway, Kyutai
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

pub mod client {
    use anyhow::Result;
    use futures_util::{
        stream::{SplitSink, StreamExt},
        SinkExt,
    };
    use std::io::Write;
    use tokio::io::AsyncWriteExt;
    use tokio_tungstenite::tungstenite::protocol::Message;

    type WebSocket = tokio_tungstenite::WebSocketStream<
        tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
    >;

    const OPUS_ENCODER_FRAME_SIZE: usize = 960;

    pub struct MsgSender {
        pw: ogg::PacketWriter<'static, Vec<u8>>,
        encoder: opus::Encoder,
        out_pcm: std::collections::VecDeque<f32>,
        out_pcm_buf: Vec<u8>,
        total_data: usize,
        sender: SplitSink<WebSocket, Message>,
    }

    pub(crate) fn write_opus_header<W: std::io::Write>(w: &mut W) -> std::io::Result<()> {
        use byteorder::WriteBytesExt;

        // https://wiki.xiph.org/OggOpus#ID_Header
        w.write_all(b"OpusHead")?;
        w.write_u8(1)?; // version
        w.write_u8(1)?; // channel count
        w.write_u16::<byteorder::LittleEndian>(3840)?; // pre-skip
        w.write_u32::<byteorder::LittleEndian>(48000)?; //  sample-rate in Hz
        w.write_i16::<byteorder::LittleEndian>(0)?; // output gain Q7.8 in dB
        w.write_u8(0)?; // channel map
        Ok(())
    }

    pub(crate) fn write_opus_tags<W: std::io::Write>(w: &mut W) -> std::io::Result<()> {
        use byteorder::WriteBytesExt;

        // https://wiki.xiph.org/OggOpus#Comment_Header
        let vendor = "KyutaiMoshi";
        w.write_all(b"OpusTags")?;
        w.write_u32::<byteorder::LittleEndian>(vendor.len() as u32)?; // vendor string length
        w.write_all(vendor.as_bytes())?; // vendor string, UTF8 encoded
        w.write_u32::<byteorder::LittleEndian>(0u32)?; // number of tags
        Ok(())
    }

    impl MsgSender {
        pub fn new(sender: SplitSink<WebSocket, Message>) -> Result<Self> {
            let encoder = opus::Encoder::new(24000, opus::Channels::Mono, opus::Application::Voip)?;
            // Not sure what the appropriate buffer size would be here.
            let out_pcm_buf = vec![0u8; 50_000];
            let out_pcm = std::collections::VecDeque::with_capacity(2 * OPUS_ENCODER_FRAME_SIZE);

            let all_data = Vec::new();
            let mut pw = ogg::PacketWriter::new(all_data);
            let mut head = Vec::new();
            write_opus_header(&mut head)?;
            pw.write_packet(head, 42, ogg::PacketWriteEndInfo::EndPage, 0)?;
            let mut tags = Vec::new();
            write_opus_tags(&mut tags)?;
            pw.write_packet(tags, 42, ogg::PacketWriteEndInfo::EndPage, 0)?;
            Ok(Self { pw, encoder, out_pcm, out_pcm_buf, total_data: 0, sender })
        }

        pub async fn send_control(&mut self, control: u8) -> Result<()> {
            let msg = Message::Binary(vec![3u8, control]);
            self.sender.send(msg).await?;
            Ok(())
        }

        pub async fn send_pcm(&mut self, pcm: &[f32]) -> Result<()> {
            self.out_pcm.extend(pcm.iter());
            self.total_data += pcm.len();
            let nchunks = self.out_pcm.len() / OPUS_ENCODER_FRAME_SIZE;
            for _chunk_id in 0..nchunks {
                let mut chunk = Vec::with_capacity(OPUS_ENCODER_FRAME_SIZE);
                for _i in 0..OPUS_ENCODER_FRAME_SIZE {
                    let v = match self.out_pcm.pop_front() {
                        None => anyhow::bail!("unexpected err popping from pcms"),
                        Some(v) => v,
                    };
                    chunk.push(v)
                }
                let size = self.encoder.encode_float(&chunk, &mut self.out_pcm_buf)?;
                if size > 0 {
                    let msg = self.out_pcm_buf[..size].to_vec();
                    self.pw.write_packet(
                        msg,
                        42,
                        ogg::PacketWriteEndInfo::EndPage,
                        self.total_data as u64,
                    )?
                }
                let data = self.pw.inner_mut();
                if !data.is_empty() {
                    let msg: Vec<u8> = [&[1u8], data.as_slice()].concat();
                    let msg = Message::Binary(msg);
                    self.sender.send(msg).await?;
                    data.clear();
                }
            }
            Ok(())
        }
    }

    pub async fn run(host: String, secret_key: String, audio_topk: u32, audio_temperature: f32, text_topk: u32, text_temperature: f32) -> Result<()> {
        use tokio_tungstenite::tungstenite::client::IntoClientRequest;
        let uri = url::Url::parse(&format!("wss://{host}/api/chat?=text_temperature={text_temperature}&text_topk={text_topk}&audio_temperature={audio_temperature}&audio_topk={audio_topk}"))?;
        let mut req = uri.into_client_request()?;
        let headers = req.headers_mut();
        headers.insert("host", host.parse()?);
        headers.insert("Authorization", format!("Bearer {secret_key}").parse()?);

        let (_stream, ad) = crate::audio_io::setup_output_stream(true)?;
        let (_in_stream, input_audio) = crate::audio_io::setup_input_stream()?;
        let connector =
            native_tls::TlsConnector::builder().danger_accept_invalid_certs(true).build()?;
        let (stream, response) = tokio_tungstenite::connect_async_tls_with_config(
            req,
            None,
            false,
            Some(tokio_tungstenite::Connector::NativeTls(connector)),
        )
        .await?;
        tracing::info!("connected, got {response:?}");

        let (sender, mut receiver) = stream.split();
        let mut sender = MsgSender::new(sender)?;
        let (mut tx, rx) = tokio::io::duplex(100_000);
        tokio::spawn(async move {
            let mut decoder = opus::Decoder::new(24000, opus::Channels::Mono)?;
            let mut pr = ogg::reading::async_api::PacketReader::new(rx);
            let mut pcm_buf = vec![0f32; 24_000 * 120];
            let mut all_pcms = vec![];
            let mut total_size = 0;
            tracing::info!("waiting for audio data");
            while let Some(packet) = pr.next().await {
                let packet = packet?;
                if packet.data.starts_with(b"OpusHead") || packet.data.starts_with(b"OpusTags") {
                    continue;
                }
                let size = decoder.decode_float(
                    &packet.data,
                    &mut pcm_buf,
                    /* Forward Error Correction */ false,
                )?;
                if size > 0 {
                    let pcm = &pcm_buf[..size];
                    total_size += size;
                    all_pcms.push(pcm.to_vec());
                    let mut ad = ad.lock().unwrap();
                    ad.push_samples(pcm)?;
                }
            }
            let all_pcms = all_pcms.concat();
            tracing::info!(len = all_pcms.len(), "saving pcms with shape");
            let mut w = std::fs::File::create("received.wav")?;
            crate::audio_io::write_pcm_as_wav(&mut w, &all_pcms, 24000)?;
            Ok::<(), anyhow::Error>(())
        });
        tokio::spawn(async move {
            loop {
                let input = input_audio.lock().unwrap().take_all();
                if sender.send_pcm(&input).await.is_err() {
                    break;
                };
                tokio::time::sleep(std::time::Duration::from_millis(20)).await
            }
        });
        while let Some(received) = receiver.next().await {
            match received? {
                Message::Close(_) => break,
                Message::Text(text) => {
                    tracing::error!("unexpected text message {text}");
                    continue;
                }
                Message::Frame(_) | Message::Ping(_) | Message::Pong(_) => continue,
                Message::Binary(bin) => {
                    if bin.is_empty() {
                        continue;
                    }
                    match bin[0] {
                        // Handshake
                        0 => {}
                        // Audio
                        1 => {
                            tx.write_all(&bin[1..]).await?;
                        }
                        2 => {
                            let txt = String::from_utf8_lossy(&bin[1..]);
                            print!("{txt}");
                            std::io::stdout().flush()?;
                        }
                        3 => {
                            tracing::error!("unsupported control message")
                        }
                        4 => {
                            tracing::error!("unsupported metadata message")
                        }
                        mt => {
                            tracing::error!("unexpected message type {mt}");
                            continue;
                        }
                    }
                }
            };
        }
        println!("\n");
        Ok(())
    }
}