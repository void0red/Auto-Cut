# copy from https://github.com/lovegaoshi/bili-music-segmenter/blob/inaseg-cloud/segment/segment.py

from inaSpeechSegmenter import Segmenter

from config import *


def segment(
    media: str,
    batch_size: int = BATCH_SIZE,
    energy_ratio: float = ENERGY_RATIO,
):
    segmenter = Segmenter(
        vad_engine="sm",
        detect_gender=False,
        energy_ratio=energy_ratio,
        batch_size=batch_size,
    )
    segmentation = segmenter(media)
    return segmentation


def extract_music(
    media: str,
    batch_size: int = BATCH_SIZE,
    energy_ratio: float = ENERGY_RATIO,
    segment_thres=EXTRACT_SEG_THRES,
    segment_thres_final=EXTRACT_SEG_THRES_FINAL,
    segment_connect=EXTRACT_SEG_CONNECT,
    start_padding=1,
    end_padding=4,
):
    segmentation = segment(media, batch_size, energy_ratio)
    r = []
    # bridges noEnergy segments that are likely fragmented
    for i in range(len(segmentation) - 2, 0, -1):
        if (
            segmentation[i][0] == "noEnergy"
            and segmentation[i][2] - segmentation[i][1] < 4
            and segmentation[i - 1][0] == segmentation[i + 1][0]
        ):
            segmentation[i - 1] = (
                segmentation[i - 1][0],
                segmentation[i - 1][1],
                segmentation[i + 1][2],
            )
    for i in segmentation:
        if i[0] == "music" and i[2] - i[1] > segment_thres:
            r.append(["", i[1] - start_padding, i[2] + end_padding])
    for i in range(len(r) - 1, 0, -1):
        if r[i][1] - r[i - 1][2] < segment_connect:
            r[i - 1][2] = r[i][2]
            r[i][1] = r[i][2] + 1
    rf = []
    for i in r:
        if i[1] < 5:
            continue
        if i[2] - i[1] > segment_thres_final:
            rf.append(i)
    return [[x[1], x[2]] for x in rf]


if __name__ == "__main__":
    seg = extract_music("videos/mumu-7.8.mp4")
    print(seg)
