const videoPlayer = document.getElementById('videoPlayer');
const videoSelect = document.getElementById('videoSelect');
const setStartTimeBtn = document.getElementById('setStartTimeBtn');
const setEndTimeBtn = document.getElementById('setEndTimeBtn');
const addSegmentBtn = document.getElementById('addSegmentBtn');
const cutVideoBtn = document.getElementById('cutVideoBtn');
const segmentListDiv = document.getElementById('segmentList');
const noSegmentsMessage = document.getElementById('noSegmentsMessage');
const messageDiv = document.getElementById('message');
const currentTimeDisplay = document.getElementById('currentTimeDisplay');
const currentSegmentDisplay = document.getElementById('currentSegmentDisplay');
const autoSegmentsBtn = document.getElementById('autoSegmentsBtn');
const backward3sBtn = document.getElementById('backward3sBtn');
const forward3sBtn = document.getElementById('forward3sBtn');
const backward1sBtn = document.getElementById('backward1sBtn');
const forward1sBtn = document.getElementById('forward1sBtn');

let highlightedSegmentIndex = -1;

let currentVideoFilename = '';
let startTime = -1;
let endTime = -1;
let segments = [];

// 辅助函数：将秒数格式化为 HH:MM:SS
function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return [h, m, s]
        .map(v => String(v).padStart(2, '0'))
        .join(':');
}

// 辅助函数：将 HH:MM:SS 格式转换为秒数
function parseTimeToSeconds(timeString) {
    const parts = timeString.split(':').map(Number);
    let seconds = 0;
    if (parts.length === 3) { // HH:MM:SS
        seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) { // MM:SS
        seconds = parts[0] * 60 + parts[1];
    } else if (parts.length === 1) { // SS
        seconds = parts[0];
    }
    return seconds;
}

// 从服务器加载当前视频的片段 (此函数仍会被videoSelect的change事件和DOMContentLoaded调用)
async function loadSegments() {
    if (!currentVideoFilename) {
        segments = [];
        renderSegments();
        return;
    }

    try {
        const response = await fetch(`/load_segments?videoFilename=${encodeURIComponent(currentVideoFilename)}`);
        const result = await response.json();

        if (result.status === 'success') {
            segments = result.segments;
            showMessage(result.message, 'success');
        } else if (result.status === 'not_found') {
            segments = [];
            showMessage(result.message, 'info');
        } else {
            segments = [];
            showMessage(`加载失败: ${result.message}`, 'error');
        }
    } catch (e) {
        segments = [];
        showMessage(`加载请求失败: ${e.message}`, 'error');
        console.error("Error loading segments from server:", e);
    } finally {
        renderSegments(); // 无论成功失败，都重新渲染列表
    }
}


// 实时更新视频播放时间显示
videoPlayer.addEventListener('timeupdate', () => {
    currentTimeDisplay.textContent = formatTime(videoPlayer.currentTime);
    highlightCurrentSegment(videoPlayer.currentTime);
});

function highlightCurrentSegment(currentTime) {
    let newHighlightedIndex = -1;
    for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        // 增加一点容错，如果当前时间在片段开始前0.1秒到片段结束前0.1秒之间
        // 确保在片段快结束时，高亮不会过早消失
        if (currentTime >= segment.start - 0.1 && currentTime <= segment.end + 0.1) {
            newHighlightedIndex = i;
            break;
        }
    }

    if (newHighlightedIndex !== highlightedSegmentIndex) {
        // 移除旧的高亮
        if (highlightedSegmentIndex !== -1) {
            const oldHighlightedItem = document.querySelector(`.segment-item[data-index="${highlightedSegmentIndex}"]`);
            if (oldHighlightedItem) {
                oldHighlightedItem.classList.remove('highlighted-segment');
            }
        }
        // 添加新的高亮
        if (newHighlightedIndex !== -1) {
            const newHighlightedItem = document.querySelector(`.segment-item[data-index="${newHighlightedIndex}"]`);
            if (newHighlightedItem) {
                newHighlightedItem.classList.add('highlighted-segment');
            }
        }
        highlightedSegmentIndex = newHighlightedIndex;
    }
}

// 视频选择下拉菜单的事件监听
videoSelect.addEventListener('change', () => {
    currentVideoFilename = videoSelect.value;
    if (currentVideoFilename) {
        videoPlayer.src = `/video/${currentVideoFilename}`;
        videoPlayer.load();
        videoPlayer.style.display = 'block';
        // ⬇️ 修改：启用自动分段按钮和剪辑按钮
        autoSegmentsBtn.disabled = false;
        cutVideoBtn.disabled = false;
        startTime = -1;
        endTime = -1;
        currentSegmentDisplay.textContent = '无';
    } else {
        videoPlayer.src = '';
        videoPlayer.style.display = 'none';
        segments = [];
        renderSegments();
        // ⬇️ 修改：禁用自动分段按钮和剪辑按钮
        autoSegmentsBtn.disabled = true;
        cutVideoBtn.disabled = true;
    }
    hideMessage();
});

// 重置所有标记和片段列表 (主动清空，会保存空状态到服务器)
function resetMarksAndSegments() {
    startTime = -1;
    endTime = -1;
    segments = [];
    currentSegmentDisplay.textContent = '无';
    renderSegments();
    hideMessage();
}

// 标记开始时间
setStartTimeBtn.addEventListener('click', () => {
    if (!videoPlayer.src) {
        showMessage('请先选择一个视频。', 'error');
        return;
    }
    startTime = videoPlayer.currentTime;
    endTime = -1;
    currentSegmentDisplay.textContent = `开始: ${formatTime(startTime)}`;
    showMessage(`✔ 已标记开始时间: ${formatTime(startTime)}`, 'success');
});

// 标记结束时间
setEndTimeBtn.addEventListener('click', () => {
    if (!videoPlayer.src) {
        showMessage('请先选择一个视频。', 'error');
        return;
    }
    if (startTime === -1) {
        showMessage('⚠️ 请先标记开始时间。', 'error');
        return;
    }
    endTime = videoPlayer.currentTime;
    currentSegmentDisplay.textContent = `开始: ${formatTime(startTime)}, 结束: ${formatTime(endTime)}`;
    showMessage(`✔ 已标记结束时间: ${formatTime(endTime)}`, 'success');
});

// 添加片段到列表
addSegmentBtn.addEventListener('click', () => {
    if (!videoPlayer.src) {
        showMessage('请先选择一个视频。', 'error');
        return;
    }
    if (startTime === -1 || endTime === -1) {
        showMessage('⚠️ 请完整标记一个片段的开始和结束时间。', 'error');
        return;
    }
    if (endTime <= startTime) {
        showMessage('⚠️ 结束时间必须晚于开始时间。', 'error');
        return;
    }

    segments.push({ start: startTime, end: endTime, is_clipped: false, output_url: null });
    showMessage(`✅ 片段已添加: ${formatTime(startTime)} - ${formatTime(endTime)}`, 'success');

    startTime = -1;
    endTime = -1;
    currentSegmentDisplay.textContent = '无';
    renderSegments();
});

backward3sBtn.addEventListener('click', () => {
    videoPlayer.currentTime -= 3;
});

forward3sBtn.addEventListener('click', () => {
    videoPlayer.currentTime += 3;
});

backward1sBtn.addEventListener('click', () => {
    videoPlayer.currentTime -= 1;
});

forward1sBtn.addEventListener('click', () => {
    videoPlayer.currentTime += 1;
});

currentTimeDisplay.addEventListener('click', () => {
    navigator.clipboard.writeText(currentTimeDisplay.textContent);
});

// 从列表中移除片段
function removeSegment(index) {
    segments.splice(index, 1);
    renderSegments();
    showMessage('🗑️ 片段已移除。', 'success');
}

// 点击片段跳转视频时间
function jumpToSegmentStart(index) {
    if (!videoPlayer.src || index < 0 || index >= segments.length) {
        return;
    }
    const segment = segments[index];
    videoPlayer.currentTime = segment.start;
    videoPlayer.play();
    videoPlayer.focus();
    showMessage(`👉 已跳转到片段 ${index + 1} 的开始点: ${formatTime(segment.start)} 并已播放`, 'info');
}

function jumpToSegmentEnd(index) {
    if (!videoPlayer.src || index < 0 || index >= segments.length) {
        return;
    }
    const segment = segments[index];
    videoPlayer.currentTime = segment.end;
    videoPlayer.play();
    videoPlayer.pause();
    showMessage(`👉 已跳转到片段 ${index + 1} 的结尾点: ${formatTime(segment.end)} 并已暂停`, 'info');
}

// 处理输入框编辑和回车确认
function handleSegmentTimeEdit(event, index, type) {
    const inputElement = event.target;
    if (segments[index].is_clipped) {
        inputElement.value = formatTime(segments[index][type]);
        showMessage('该片段已标记为完成，不能再编辑。', 'info');
        return;
    }

    if (event.type === 'keydown' && event.key !== 'Enter') {
        return;
    }
    if (event.key === 'Enter') {
        event.preventDefault();
        inputElement.blur();
    }

    if (event.type === 'blur' || event.key === 'Enter') {
        const newValueStr = inputElement.value.trim();
        const newValue = parseTimeToSeconds(newValueStr);

        if (isNaN(newValue) || newValue < 0) {
            showMessage('⚠️ 无效的时间格式。请使用 HH:MM:SS 或 MM:SS 或 SS 格式。', 'error');
            inputElement.value = formatTime(segments[index][type]);
            return;
        }

        const currentSegment = segments[index];
        let newStart = (type === 'start') ? newValue : currentSegment.start;
        let newEnd = (type === 'end') ? newValue : currentSegment.end;

        if (newEnd <= newStart) {
            showMessage('⚠️ 结束时间必须晚于开始时间。', 'error');
            inputElement.value = formatTime(currentSegment[type]);
            return;
        }

        if (currentSegment[type] !== newValue) {
            segments[index][type] = newValue;
            showMessage(`👍 片段 ${index + 1} 的 ${type === 'start' ? '开始' : '结束'}时间已更新！`, 'success');
            renderSegments();
        }
    }
}

// 渲染或更新页面上的片段列表
function renderSegments() {
    segmentListDiv.innerHTML = '';
    if (segments.length === 0) {
        noSegmentsMessage.style.display = 'block';
    } else {
        noSegmentsMessage.style.display = 'none';
        segments.forEach((seg, index) => {
            const segmentItem = document.createElement('div');
            segmentItem.classList.add('segment-item');
            if (seg.is_clipped) {
                segmentItem.classList.add('clipped');
            }
            segmentItem.setAttribute('data-index', index);

            const inputDisabledAttr = seg.is_clipped ? 'disabled' : '';
            const duration = seg.end - seg.start;
            const formattedDuration = formatTime(duration);

            segmentItem.innerHTML = `
                <span>片段 ${index + 1}: </span>
                <input type="text" class="segment-time-input start-time-input" value="${formatTime(seg.start)}"
                       data-index="${index}" data-type="start" ${inputDisabledAttr}
                       title="${seg.is_clipped ? '已完成片段，不可编辑' : '点击或按回车编辑开始时间'}">
                <span> - </span>
                <input type="text" class="segment-time-input end-time-input" value="${formatTime(seg.end)}"
                       data-index="${index}" data-type="end" ${inputDisabledAttr}
                       title="${seg.is_clipped ? '已完成片段，不可编辑' : '点击或按回车编辑结束时间'}">
                <span> - </span>
                <span class="segment-duration">(时长: ${formattedDuration})</span>
                <div class="segment-actions">
                    ${seg.is_clipped && seg.output_url ?
                    `<a href="${seg.output_url}" target="_blank" class="clipped-link" title="点击预览已剪辑片段, 双击跳转到结尾">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                            <span>已完成，点击预览</span>
                        </a>`
                    :
                    `<button class="remove-btn" data-index="${index}">移除</button>`
                }
                </div>
            `;
            segmentItem.addEventListener('click', (event) => {
                if (!event.target.classList.contains('remove-btn') &&
                    !event.target.classList.contains('segment-time-input') &&
                    !event.target.closest('.clipped-link')) {
                    jumpToSegmentStart(index);
                }
            });
            segmentItem.addEventListener('contextmenu', (event) => {
                if (!event.target.classList.contains('remove-btn') &&
                    !event.target.classList.contains('segment-time-input') &&
                    !event.target.closest('.clipped-link')) {
                    jumpToSegmentEnd(index);
                }
            });
            segmentListDiv.appendChild(segmentItem);
        });

        document.querySelectorAll('.segment-time-input').forEach(input => {
            const index = parseInt(input.dataset.index);
            const type = input.dataset.type;
            if (!segments[index].is_clipped) {
                input.addEventListener('blur', (event) => handleSegmentTimeEdit(event, index, type));
                input.addEventListener('keydown', (event) => handleSegmentTimeEdit(event, index, type));
            }
            input.addEventListener('click', (event) => event.stopPropagation());
        });

        document.querySelectorAll('.remove-btn').forEach(button => {
            button.onclick = (event) => {
                event.stopPropagation();
                removeSegment(parseInt(button.dataset.index));
            };
        });
    }
    // ⬇️ 修改：根据是否有片段或视频选择，启用/禁用剪辑按钮和自动分段按钮
    cutVideoBtn.disabled = (segments.length === 0 || !currentVideoFilename);
    autoSegmentsBtn.disabled = !currentVideoFilename; // 只有选择了视频才能自动分段


    if (videoPlayer.readyState > 0) { // 确保视频已加载，否则 currentTime 可能为0
        highlightCurrentSegment(videoPlayer.currentTime);
    } else {
        // 如果视频还没加载好，确保移除所有高亮
        if (highlightedSegmentIndex !== -1) {
            const oldHighlightedItem = document.querySelector(`.segment-item[data-index="${highlightedSegmentIndex}"]`);
            if (oldHighlightedItem) {
                oldHighlightedItem.classList.remove('highlighted-segment');
            }
            highlightedSegmentIndex = -1;
        }
    }
}

// 剪辑视频按钮的事件监听
cutVideoBtn.addEventListener('click', async () => {
    if (!currentVideoFilename) {
        showMessage('⚠️ 请先选择一个视频。', 'error');
        return;
    }

    const unclippedSegments = segments.filter(seg => !seg.is_clipped);

    if (unclippedSegments.length === 0) {
        showMessage('⚠️ 没有待剪辑的片段了。请添加新片段或重置。', 'error');
        return;
    }

    showMessage('⏳ 正在剪辑视频，请稍候...这可能需要一些时间，请勿关闭页面。', 'info');
    cutVideoBtn.disabled = true;

    try {
        const response = await fetch('/process_cut', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                videoFilename: currentVideoFilename,
                segments: unclippedSegments
            })
        });

        const result = await response.json();

        if (result.status === 'success') {
            result.outputUrls.forEach((url, i) => {
                const originalSegment = unclippedSegments[i];
                const originalIndexInFullList = segments.findIndex(seg =>
                    !seg.is_clipped && seg.start === originalSegment.start && seg.end === originalSegment.end
                );

                if (originalIndexInFullList !== -1) {
                    segments[originalIndexInFullList].is_clipped = true;
                    segments[originalIndexInFullList].output_url = url;
                }
            });
            showMessage('🎉 剪辑成功！', 'success');
            renderSegments();
        } else {
            showMessage(`❌ 剪辑失败: ${result.message}`, 'error');
        }
    } catch (error) {
        showMessage(`❗ 请求失败: ${error.message}。请检查控制台或服务器日志。`, 'error');
    } finally {
        cutVideoBtn.disabled = false;
    }
});


// ⬇️ 新增：自动分段按钮的事件监听
autoSegmentsBtn.addEventListener('click', async () => {
    if (!currentVideoFilename) {
        showMessage('请先选择一个视频文件，才能进行自动分段。', 'error');
        return;
    }

    showMessage('⏳ 正在进行自动分段分析，请稍候...这可能需要一些时间。', 'info');
    autoSegmentsBtn.disabled = true; // 禁用按钮防止重复点击
    cutVideoBtn.disabled = true; // 分析时也禁用剪辑按钮

    try {
        const response = await fetch('/auto_segment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                videoFilename: currentVideoFilename
            })
        });

        const result = await response.json();

        if (result.status === 'success' || result.status === 'info') {
            segments = result.segments.map(seg => ({
                start: seg[0],
                end: seg[1],
                is_clipped: false,
                output_url: ''
            }));
            showMessage(result.message, 'success');
        } else {
            showMessage(`自动分段失败: ${result.message}`, 'error');
        }
    } catch (e) {
        segments = []; // 请求失败，清空前端片段
        showMessage(`自动分段请求失败: ${e.message}`, 'error');
        console.error("Error with auto-segment request:", e);
    } finally {
        autoSegmentsBtn.disabled = false; // 重新启用自动分段按钮
        renderSegments(); // 无论成功失败，都重新渲染列表
    }
});


// 显示消息提示
function showMessage(msg, type) {
    messageDiv.textContent = '';
    messageDiv.innerHTML = msg;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
}

// 隐藏消息提示
function hideMessage() {
    messageDiv.style.display = 'none';
}

// 页面加载时的初始化
document.addEventListener('DOMContentLoaded', () => {
    currentVideoFilename = videoSelect.value;
    if (currentVideoFilename) {
        videoPlayer.src = `/video/${currentVideoFilename}`;
        videoPlayer.load();
        videoPlayer.style.display = 'block';
        autoSegmentsBtn.disabled = false; // 首次加载时启用自动分段按钮
        cutVideoBtn.disabled = false;
    } else {
        videoPlayer.src = '';
        videoPlayer.style.display = 'none';
        segments = [];
        renderSegments();
        autoSegmentsBtn.disabled = true;
        cutVideoBtn.disabled = true;
    }
});