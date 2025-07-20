from funasr import AutoModel
from funasr.utils.postprocess_utils import rich_transcription_postprocess
from pathlib import Path
from openai import OpenAI
from dotenv import load_dotenv
import os

load_dotenv()
llm_model = OpenAI(base_url=os.getenv("OPENAI_API_BASE"))


asr_model = None


def lazy_asr_model():
    global asr_model
    if asr_model == None:
        asr_model = AutoModel(
            model="iic/SenseVoiceSmall",
            vad_model="fsmn-vad",
            vad_kwargs={"max_single_segment_time": 30000},
            disable_update=True,
        )
    return asr_model


def asr(video_path):
    asr_file = Path(video_path).with_suffix(".asr")
    if asr_file.exists():
        text = asr_file.read_text(encoding="utf-8")
        if text != "":
            return text

    asr_model = lazy_asr_model()
    res = asr_model.generate(
        input=video_path,
        cache={},
        language="auto",
        use_itn=True,
        batch_size_s=60,
        merge_vad=True,  #
        merge_length_s=15,
    )
    text = rich_transcription_postprocess(res[0]["text"])
    asr_file.write_text(text, encoding="utf-8")
    return text


def query_name(lyric: str) -> str:
    response = llm_model.chat.completions.create(
        model=os.getenv("OPENAI_MODEL_NAME"),
        messages=[
            {
                "role": "user",
                "content": f"这是什么歌，只输出歌名：{lyric}",
            },
        ],
        extra_body={"enable_search": True},
    )

    return response.choices[0].message.content.replace("《", "").replace("》", "")


def get_name_lyric_by_asr(video: str):
    lyric = asr(video)
    return query_name(lyric), lyric


if __name__ == "__main__":
    fn = "cut_videos/mumu-7.08.mp4_segment_1.mp4"
    print(get_name_lyric_by_asr(fn))
