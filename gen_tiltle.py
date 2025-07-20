from openai import OpenAI
from dotenv import load_dotenv
import os
import re
from afp import get_name_lyric_by_afp
from pathlib import Path
from asr import get_name_lyric_by_asr

load_dotenv()

llm_model = OpenAI(base_url=os.getenv("OPENAI_API_BASE"))


def infer_title(lyric: str):
    response = llm_model.chat.completions.create(
        model=os.getenv("OPENAI_MODEL_NAME"),
        messages=[
            {
                "role": "system",
                "content": "你是一个唱歌视频标题生成器，根据歌词内容，仅输出推荐的一个标题，风趣有吸引力，不要做多余的讨论",
            },
            {
                "role": "user",
                "content": f"这是bilibili虚拟主播`木木sylvia_`的直播唱歌片段，请根据以下歌词生成中文视频标题：{lyric}",
            },
        ],
        extra_body={"enable_search": True},
    )

    return response.choices[0].message.content


def extract_date_from_filename(fn: str):
    date = re.search(r"(\d+.\d+)", fn).group(0)
    return date


def gen_title(date: str, name: str, title: str):
    return f"【木木sylvia {date} 歌切】《{name}》{title}"


def gen_title_entry(video: str):
    try:
        date = extract_date_from_filename(video)
        name, lyric = get_name_lyric_by_afp(video)
        if not name:
            name, lyric = get_name_lyric_by_asr(video)
        title = gen_title(date, name, infer_title(lyric))
        return title
    except:
        return ""


if __name__ == "__main__":
    for i in os.listdir("cut_videos"):
        if not i.endswith("mp4"):
            continue
        if i.startswith("【"):
            continue
        fn = os.path.join("cut_videos", i)
        title = gen_title_entry(fn)
        print(f"{fn}->{title}")
        os.rename(fn, Path(fn).with_name(title + ".mp4"))
