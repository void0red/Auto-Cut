from flask import Flask, render_template, request, jsonify, send_from_directory
import os
import subprocess
from infer import extract_music
import json
from config import *
from asr import asr

app = Flask(__name__)


# --- 路由定义 ---


@app.route("/")
def index():
    """渲染主页，并列出可用的视频文件"""
    videos = [
        f
        for f in os.listdir(VIDEO_FOLDER)
        if f.lower().endswith((".mp4", ".mov", ".avi", ".mkv"))
    ]
    return render_template("index.html", videos=videos)


@app.route("/video/<filename>")
def serve_video(filename):
    """用于从 'videos' 文件夹提供原始视频文件"""
    return send_from_directory(VIDEO_FOLDER, filename)


@app.route(f"/{CUT_VIDEO_FOLDER}/<filename>")
def serve_cut_video(filename):
    """用于从 'cut_videos' 文件夹提供剪辑后的视频文件"""
    return send_from_directory(CUT_VIDEO_FOLDER, filename)


@app.route("/process_cut", methods=["POST"])
def process_cut():
    """处理视频剪辑请求，将每个片段独立存储"""
    data = request.json
    video_filename = data.get("videoFilename")
    segments = data.get("segments")  # 列表，每个元素是 {'start': float, 'end': float}

    if not video_filename or not segments:
        return (
            jsonify({"status": "error", "message": "缺少视频文件名或剪辑片段数据"}),
            400,
        )

    input_video_path = os.path.join(VIDEO_FOLDER, video_filename)
    if not os.path.exists(input_video_path):
        return (
            jsonify(
                {"status": "error", "message": f"视频文件未找到: {video_filename}"}
            ),
            404,
        )

    output_urls = []  # 存储所有输出片段的URL

    try:
        # 循环处理每个片段，并将其独立保存
        for i, segment in enumerate(segments):
            start = segment["start"]
            end = segment["end"]
            duration = end - start
            if duration <= 0:
                print(f"警告: 片段 {i+1} (开始: {start}, 结束: {end}) 无效，已跳过。")
                continue

            # 为每个输出片段生成一个唯一的名称
            output_segment_filename = f"{video_filename}_segment_{i+1}.mp4"
            output_segment_path = os.path.join(
                CUT_VIDEO_FOLDER, output_segment_filename
            )

            # FFmpeg 命令用于剪辑单个片段
            # -ss 在 -i 之前用于快速跳转 (基于关键帧)，-to 用于指定输出片段的持续时间
            # -c copy 用于复制流，不进行重新编码，速度快但可能在非关键帧处有微小误差
            command = [
                FFMPEG_PATH,
                "-ss",
                str(start),
                "-i",
                input_video_path,
                "-to",
                str(duration),
                "-c",
                "copy",
                "-map",
                "0",  # 映射所有流 (视频、音频等)
                "-y",  # 覆盖输出文件而不询问
                output_segment_path,
            ]
            print(f"执行剪辑命令 (片段 {i+1}): {' '.join(command)}")
            subprocess.run(command, check=True, capture_output=True)

            output_urls.append(f"/{CUT_VIDEO_FOLDER}/{output_segment_filename}")

        if not output_urls:
            return (
                jsonify({"status": "error", "message": "没有有效的片段可供剪辑。"}),
                400,
            )

        for i in output_urls:
            asr(f"{CUT_VIDEO_FOLDER}/{i}")

        return jsonify(
            {
                "status": "success",
                "message": "视频片段已成功剪辑并独立保存！",
                "outputUrls": output_urls,
            }
        )

    except subprocess.CalledProcessError as e:
        error_message = e.stderr.decode(errors="ignore")
        print(f"FFmpeg 错误: {error_message}")
        return (
            jsonify({"status": "error", "message": f"视频剪辑失败: {error_message}"}),
            500,
        )
    except Exception as e:
        print(f"服务器内部错误: {e}")
        return jsonify({"status": "error", "message": f"发生未知错误: {str(e)}"}), 500


@app.route("/auto_segment", methods=["POST"])
def auto_segment():
    data = request.json
    video_filename = data.get("videoFilename")
    if not video_filename:
        return (
            jsonify({"status": "error", "message": "缺少视频文件名"}),
            400,
        )
    video_path = os.path.join(VIDEO_FOLDER, video_filename)
    if not os.path.exists(video_path):
        return (
            jsonify(
                {"status": "error", "message": f"视频文件未找到: {video_filename}"}
            ),
            404,
        )

    seg_path = os.path.join(VIDEO_FOLDER, video_filename + ".json")
    try:
        if not os.path.exists(seg_path):
            seg = extract_music(video_path)
            json.dump(seg, open(seg_path, "w"), indent=2)
        else:
            seg = json.load(open(seg_path, "r"))
        return (
            jsonify(
                {
                    "status": "success",
                    "message": f"已自动分段， 共{len(seg)}段",
                    "segments": seg,
                }
            ),
            200,
        )
    except:
        if os.path.exists(seg_path):
            os.remove(seg_path)
        return (
            jsonify(
                {
                    "status": "error",
                    "message": f"自动分段失败",
                }
            ),
            500,
        )


if __name__ == "__main__":
    app.run(debug=True, port=5000)
