from funasr import AutoModel
from funasr.utils.postprocess_utils import rich_transcription_postprocess
from openai import OpenAI
from dotenv import load_dotenv
import os
from pathlib import Path
import re

load_dotenv()
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


llm_model = OpenAI(base_url=os.getenv("OPENAI_API_BASE"))


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


def gen_title(lyric: str, date: str):
    response = llm_model.chat.completions.create(
        model=os.getenv("OPENAI_MODEL_NAME"),
        messages=[
            {
                "role": "system",
                "content": "你是一个视频标题生成器，只输出推荐的一个标题，风趣有吸引力，需要包含歌曲名，格式：【{人名}{日期}歌切】|《{歌曲名}》 {其他}",
            },
            {
                "role": "user",
                "content": f"这是bilibili虚拟主播`木木sylvia_`在{date}的直播唱歌片段，请根据以下歌词生成中文视频标题：{lyric}",
            },
        ],
        extra_body={"enable_search": True},
    )

    return response.choices[0].message.content


def extract_date_from_filename(fn: str):
    date = re.search(r"(\d+.\d+)", fn).group(0)
    return date


if __name__ == "__main__":
    videos = ["cut_videos/" + i for i in os.listdir("cut_videos") if i.endswith(".mp4")]
    # print(videos)
    for i in videos:
        date = extract_date_from_filename
        lyric = asr(i)
        # # print(lyric)
        print(gen_title(lyric, date))
        # print("=" * 100)
