import os

# --- 配置路径 ---
APP_ROOT = os.path.dirname(os.path.abspath(__file__))
VIDEO_FOLDER = os.path.join(APP_ROOT, "videos")
CUT_VIDEO_FOLDER = os.path.join(APP_ROOT, "cut_videos")

# 确保必要的目录存在
os.makedirs(VIDEO_FOLDER, exist_ok=True)
os.makedirs(CUT_VIDEO_FOLDER, exist_ok=True)

# FFmpeg 可执行文件路径 (如果ffmpeg不在系统PATH中，请改为绝对路径)
FFMPEG_PATH = os.path.join(APP_ROOT, "./ffmpeg.exe")  # 假设ffmpeg已添加到系统PATH

# infer 配置

# 识歌分段最小阈值（秒），调大了会漏 调小了会多杂谈
EXTRACT_SEG_THRES = 60
# 最终识歌分段最小阈值（秒），调大了漏TV size 调小了多杂谈
EXTRACT_SEG_THRES_FINAL = 80
# 识歌分段连接的阈值（秒），调大了会两首歌分不开 调小了会碎
EXTRACT_SEG_CONNECT = 5
# 大了会碎 小了会两首歌分不开
ENERGY_RATIO = 0.03
# 8GB VRAM 推荐 256
BATCH_SIZE = 256
