from pythonmonkey import require
from struct import unpack
import asyncio
import subprocess
from config import FFMPEG_PATH
from pyncm.apis.track import GetMatchTrackByFP, GetTrackLyrics
from multiprocessing.pool import Pool
from collections import Counter


class AFPInstance:
    DURATION: int = 3  # in seconds
    SAMPLERATE: int = 8000  # in Hz
    SAMPLECOUNT = DURATION * SAMPLERATE

    event_loop: asyncio.AbstractEventLoop

    def __init__(self) -> None:
        self.event_loop = asyncio.new_event_loop()

    def generate_fingerprint(self, sample: list[float]):
        assert len(sample) == self.SAMPLECOUNT, "Expected %d samples, got %d" % (
            self.SAMPLECOUNT,
            len(sample),
        )

        async def run():
            afp = require("./static/afp.js")
            return await afp.GenerateFP(sample)

        return self.event_loop.run_until_complete(run())


afp = AFPInstance()


def identify(audio: str, start: str = "00:00:00"):
    try:
        result = subprocess.run(
            [
                FFMPEG_PATH,
                "-ss",
                start,
                "-i",
                audio,
                "-acodec",
                "pcm_f32le",
                "-f",
                "f32le",
                "-ar",
                str(afp.SAMPLERATE),
                "-ac",
                "1",
                "-t",
                str(afp.DURATION + 1),
                "-",
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
        )
        if result.returncode != 0:
            return []

        need_len = afp.SAMPLECOUNT * 4  # f32le
        data = result.stdout[:need_len]

        buffer = list(
            unpack("<%df" % (afp.SAMPLECOUNT), data)
        )  # expecting f32le input @ 8khz
        fp = afp.generate_fingerprint(buffer)
        # print("* Fingerprint:", fp)
        result = GetMatchTrackByFP(fp, afp.DURATION)
        result = result["data"]["result"]
        ret = [(i["song"]["name"], i["song"]["id"]) for i in result]
        # print(ret)
        return ret
    except Exception as e:
        # print(e)
        return []


def get_name_id(audio: str):
    sample_time = ["00:00:00", "00:00:10", "00:00:20", "00:00:30"]
    data = []
    with Pool(4) as p:
        res = []
        for i in sample_time:
            res.append(p.apply_async(identify, args=(audio, i)))

        for i in res:
            data.extend(i.get())
    if not data:
        return "", 0
    names = [i[0] for i in data]
    name_counts = Counter(names)
    most_common_name = name_counts.most_common(1)[0][0]
    for name, id in data:
        if name == most_common_name:
            return name, id


def get_lyric(id) -> str:
    return GetTrackLyrics(id)["lrc"]["lyric"].strip()


def get_name_lyric(audio: str):
    name, id = get_name_id(audio)
    if not name:
        return None, ""
    lyric = get_lyric(id)
    return name, lyric


if __name__ == "__main__":
    fn = "cut_videos/【木木sylvia 6.30 歌切】《浮光》 穿越千年的温柔告白.mp4"
    name, lyric = get_name_lyric(fn)
    print(name, lyric)
