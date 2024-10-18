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

use anyhow::Result;
use clap::Parser;

mod audio_io;
mod multistream;

#[derive(Debug, Parser)]
struct Args {
    #[command(subcommand)]
    command: Command,

    /// Enable tracing (generates a trace-timestamp.json file).
    #[arg(long)]
    tracing: bool,
}

#[derive(Debug, clap::Subcommand)]
enum Command {
    Run {
        #[arg(long)]
        host: String,

        #[arg(long)]
        secret_key: String,

        #[arg(long, default_value_t = 250)]
        audio_topk: u32,

        #[arg(long, default_value_t = 0.8)]
        audio_temperature: f32,

        #[arg(long, default_value_t = 25)]
        text_topk: u32,

        #[arg(long, default_value_t = 0.7)]
        text_temperature: f32,
    },
}

#[tokio::main(flavor = "multi_thread", worker_threads = 10)]
async fn main() -> Result<()> {
    use tracing_chrome::ChromeLayerBuilder;
    use tracing_subscriber::prelude::*;

    let args = Args::parse();
    let _guard = if args.tracing {
        let (chrome_layer, guard) = ChromeLayerBuilder::new().build();
        tracing_subscriber::registry().with(chrome_layer).init();
        Some(guard)
    } else {
        None
    };
    match args.command {
        Command::Run { host, secret_key, audio_topk, audio_temperature, text_topk, text_temperature } => {
            tracing_subscriber::fmt::init();
            multistream::client::run(host, secret_key, audio_topk, audio_temperature, text_topk, text_temperature).await?
        }
    }
    Ok(())
}
