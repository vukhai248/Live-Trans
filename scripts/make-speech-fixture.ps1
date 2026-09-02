# Tạo fixture audio LỜI NÓI THẬT bằng Windows SAPI (có sẵn, offline).
# Xuất: tests/fixtures/speech.wav
$ErrorActionPreference = "Stop"
$OutPath = Join-Path $PSScriptRoot "..\tests\fixtures\speech.wav"
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SetOutputToWaveFile((Resolve-Path (Join-Path $PSScriptRoot "..\tests\fixtures")).Path + "\speech.wav")
$synth.Rate = 0
$synth.Speak("Welcome to Live Trans. This is a test of the transcription pipeline. First, run npm run start to launch the app. Then check the useEffect hook in React, and finally measure the gradient descent convergence.")
$synth.Dispose()
Write-Host "Created: $OutPath"
