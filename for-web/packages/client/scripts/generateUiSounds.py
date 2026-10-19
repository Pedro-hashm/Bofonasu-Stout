"""Generate the original, bundled UI sound pack. Python standard library only."""
import math
import struct
import wave
from pathlib import Path

RATE = 24000
DESTINATION = Path(__file__).resolve().parents[1] / "src" / "assets" / "sounds"

# Each note is (start, frequency, duration). No third-party recordings are used.
SOUNDS = {
    "ui_click": [(0, 1100, .035), (.009, 1650, .025)],
    "mute": [(0, 660, .09), (.065, 440, .11)],
    "unmute": [(0, 440, .09), (.065, 660, .12)],
    "deafen": [(0, 440, .1), (.075, 330, .1), (.15, 220, .13)],
    "undeafen": [(0, 330, .09), (.07, 440, .09), (.14, 660, .13)],
    "user_join_voice": [(0, 523.25, .12), (.085, 783.99, .17)],
    "user_leave_voice": [(0, 659.25, .12), (.085, 392, .17)],
    "stream_start": [(0, 523.25, .13), (.075, 659.25, .13), (.15, 1046.5, .19)],
    "stream_end": [(0, 783.99, .12), (.075, 523.25, .12), (.15, 349.23, .17)],
    "camera_on": [(0, 587.33, .09), (.055, 880, .12)],
    "camera_off": [(0, 587.33, .09), (.055, 293.66, .12)],
    "message": [(0, 783.99, .13), (.055, 1046.5, .2)],
    "stream_viewer_join": [(0, 880, .09), (.06, 1174.66, .12)],
    "stream_viewer_leave": [(0, 880, .09), (.06, 587.33, .12)],
    "user_moved": [(0, 523.25, .1), (.07, 659.25, .1), (.14, 523.25, .14)],
    "ringtone_incoming": [(t, f, .22) for t, f in [(0, 659.25), (.15, 880), (.55, 659.25), (.7, 880)]],
    "ringtone_outgoing": [(t, f, .28) for t in (0, .65) for f in (440, 554.37)],
}

DESTINATION.mkdir(parents=True, exist_ok=True)
for name, notes in SOUNDS.items():
    samples = [0.0] * math.ceil((max(t + d for t, _, d in notes) + .025) * RATE)
    for start, frequency, duration in notes:
        for i in range(math.ceil(duration * RATE)):
            t = i / RATE
            progress = t / duration
            envelope = min(1, t / .005) * min(1, (duration - t) / .025) * math.exp(-3.5 * progress)
            phase = math.tau * frequency * t
            tone = math.sin(phase) + .12 * math.sin(2 * phase) + .035 * math.sin(3 * phase)
            samples[round(start * RATE) + i] += envelope * tone
    gain = .6 / max(abs(value) for value in samples)
    pcm = b"".join(struct.pack("<h", round(value * gain * 32767)) for value in samples)
    with wave.open(str(DESTINATION / f"{name}.wav"), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(RATE)
        output.writeframes(pcm)
print(f"Generated {len(SOUNDS)} original UI sounds in {DESTINATION}")
