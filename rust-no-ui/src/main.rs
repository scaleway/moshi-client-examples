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
    #[arg(short, long, help = "The deployment UUID to which the endpoint is associated.")]
    deployment_uuid: String,

    #[arg(short = 'r', long, default_value = "fr-par", help = "The default region of the deployment.")]
    default_region: String,

    #[arg(short = 'k', long, help = "The IAM API key that secures your endpoint.")]
    iam_api_key: Option<String>,

    #[arg(long, default_value_t = false, help = "Skip SSL certificate validation.")]
    insecure: bool,

    #[arg(long, default_value_t = 250)]
    audio_topk: u32,

    #[arg(long, default_value_t = 0.8)]
    audio_temperature: f32,

    #[arg(long, default_value_t = 25)]
    text_topk: u32,

    #[arg(long, default_value_t = 0.7)]
    text_temperature: f32,
}


#[tokio::main(flavor = "multi_thread", worker_threads = 10)]
async fn main() -> Result<()> {
    let args = Args::parse();
    
    multistream::client::run(
        args.deployment_uuid,
        args.default_region,
        args.iam_api_key,
        args.insecure,
        args.audio_topk,
        args.audio_temperature,
        args.text_topk,
        args.text_temperature,
    ).await?;
    Ok(())
}
