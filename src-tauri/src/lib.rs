use lofty::file::{AudioFile, TaggedFileExt};
use lofty::read_from_path;
use lofty::tag::Accessor;
use rodio::{Decoder, OutputStream, OutputStreamBuilder, Sink, Source};
use serde::Serialize;
use std::fs::File;
use std::io::BufReader;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct FlacFileInfo {
    path: String,
    title: Option<String>,
    artist: Option<String>,
    album: Option<String>,
    genre: Option<String>,
    duration_secs: f64,
    sample_rate: Option<u32>,
    bit_depth: Option<u8>,
    channels: Option<u8>,
    overall_bitrate_kbps: Option<u32>,
    audio_bitrate_kbps: Option<u32>,
    picture_count: usize,
    codec: String,
    symphonia_sample_rate: Option<u32>,
    symphonia_channels: Option<usize>,
}

#[derive(Debug)]
struct SymphoniaInfo {
    codec: String,
    sample_rate: Option<u32>,
    channels: Option<usize>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PlaybackSnapshot {
    track_path: Option<String>,
    position_ms: u64,
    duration_ms: Option<u64>,
    volume: f32,
    paused: bool,
    has_track: bool,
    server_ts_ms: u64,
}

struct AudioEngine {
    stream: OutputStream,
    sink: Sink,
    current_track: Option<PathBuf>,
    duration: Option<Duration>,
}

struct AppState {
    audio: Mutex<AudioEngine>,
}

impl AudioEngine {
    fn new() -> Result<Self, String> {
        let stream = OutputStreamBuilder::open_default_stream().map_err(|e| e.to_string())?;
        let sink = Sink::connect_new(stream.mixer());

        Ok(Self {
            stream,
            sink,
            current_track: None,
            duration: None,
        })
    }

    fn rebuild_sink(&mut self) {
        let volume = self.sink.volume();
        let paused = self.sink.is_paused();

        self.sink.stop();
        self.sink = Sink::connect_new(self.stream.mixer());
        self.sink.set_volume(volume);

        if paused {
            self.sink.pause();
        }
    }
}

fn inspect_with_symphonia(path: &Path) -> Result<SymphoniaInfo, String> {
    let file = File::open(path).map_err(|e| e.to_string())?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());
    let mut hint = Hint::new();
    hint.with_extension("flac");

    let probed = symphonia::default::get_probe()
        .format(
            &hint,
            mss,
            &FormatOptions::default(),
            &MetadataOptions::default(),
        )
        .map_err(|e| e.to_string())?;
    let format = probed.format;
    let track = format
        .default_track()
        .ok_or_else(|| "No default audio track found".to_string())?;

    Ok(SymphoniaInfo {
        codec: format!("{:?}", track.codec_params.codec),
        sample_rate: track.codec_params.sample_rate,
        channels: track.codec_params.channels.map(|c| c.count()),
    })
}

fn read_flac_info(path: &Path) -> Result<FlacFileInfo, String> {
    let tagged = read_from_path(path).map_err(|e| e.to_string())?;
    let tag = tagged.primary_tag().or_else(|| tagged.first_tag());
    let props = tagged.properties();
    let symphonia_info = inspect_with_symphonia(path)?;

    Ok(FlacFileInfo {
        path: path.to_string_lossy().to_string(),
        title: tag.and_then(|t| t.title().map(|v| v.into_owned())),
        artist: tag.and_then(|t| t.artist().map(|v| v.into_owned())),
        album: tag.and_then(|t| t.album().map(|v| v.into_owned())),
        genre: tag.and_then(|t| t.genre().map(|v| v.into_owned())),
        duration_secs: props.duration().as_secs_f64(),
        sample_rate: props.sample_rate(),
        bit_depth: props.bit_depth(),
        channels: props.channels(),
        overall_bitrate_kbps: props.overall_bitrate(),
        audio_bitrate_kbps: props.audio_bitrate(),
        picture_count: tag.map_or(0, |t| t.pictures().len()),
        codec: symphonia_info.codec,
        symphonia_sample_rate: symphonia_info.sample_rate,
        symphonia_channels: symphonia_info.channels,
    })
}

fn unix_ts_ms() -> Result<u64, String> {
    Ok(SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis() as u64)
}

#[tauri::command]
fn parse_flac(path: String) -> Result<FlacFileInfo, String> {
    read_flac_info(Path::new(&path))
}

#[tauri::command]
fn play_flac(path: String, state: tauri::State<AppState>) -> Result<(), String> {
    let mut audio = state.audio.lock().map_err(|e| e.to_string())?;
    let path_buf = PathBuf::from(&path);
    let file = File::open(&path_buf).map_err(|e| e.to_string())?;
    let reader = BufReader::new(file);
    let decoder = Decoder::try_from(reader).map_err(|e| e.to_string())?;
    let duration = decoder.total_duration();

    audio.rebuild_sink();
    audio.sink.append(decoder);
    audio.sink.play();
    audio.current_track = Some(path_buf);
    audio.duration = duration;

    Ok(())
}

#[tauri::command]
fn pause_playback(state: tauri::State<AppState>) -> Result<(), String> {
    let audio = state.audio.lock().map_err(|e| e.to_string())?;
    audio.sink.pause();
    Ok(())
}

#[tauri::command]
fn resume_playback(state: tauri::State<AppState>) -> Result<(), String> {
    let audio = state.audio.lock().map_err(|e| e.to_string())?;
    audio.sink.play();
    Ok(())
}

#[tauri::command]
fn stop_playback(state: tauri::State<AppState>) -> Result<(), String> {
    let mut audio = state.audio.lock().map_err(|e| e.to_string())?;
    audio.sink.stop();
    audio.rebuild_sink();
    audio.current_track = None;
    audio.duration = None;
    Ok(())
}

#[tauri::command]
fn set_volume(volume: f32, state: tauri::State<AppState>) -> Result<(), String> {
    let audio = state.audio.lock().map_err(|e| e.to_string())?;
    audio.sink.set_volume(volume.clamp(0.0, 2.0));
    Ok(())
}

#[tauri::command]
fn get_volume(state: tauri::State<AppState>) -> Result<f32, String> {
    let audio = state.audio.lock().map_err(|e| e.to_string())?;
    Ok(audio.sink.volume())
}

#[tauri::command]
fn seek_to(position_ms: u64, state: tauri::State<AppState>) -> Result<(), String> {
    let audio = state.audio.lock().map_err(|e| e.to_string())?;

    if audio.current_track.is_none() {
        return Err("No track is currently loaded".to_string());
    }

    audio
        .sink
        .try_seek(Duration::from_millis(position_ms))
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn get_playback_snapshot(state: tauri::State<AppState>) -> Result<PlaybackSnapshot, String> {
    let audio = state.audio.lock().map_err(|e| e.to_string())?;

    Ok(PlaybackSnapshot {
        track_path: audio
            .current_track
            .as_ref()
            .map(|p| p.to_string_lossy().to_string()),
        position_ms: audio.sink.get_pos().as_millis() as u64,
        duration_ms: audio.duration.map(|d| d.as_millis() as u64),
        volume: audio.sink.volume(),
        paused: audio.sink.is_paused(),
        has_track: audio.current_track.is_some(),
        server_ts_ms: unix_ts_ms()?,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let audio = AudioEngine::new().expect("failed to initialize audio engine");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState {
            audio: Mutex::new(audio),
        })
        .invoke_handler(tauri::generate_handler![
            parse_flac,
            play_flac,
            pause_playback,
            resume_playback,
            stop_playback,
            set_volume,
            get_volume,
            seek_to,
            get_playback_snapshot,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
