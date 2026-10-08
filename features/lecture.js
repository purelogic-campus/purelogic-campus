// js/features/lecture.js
export function toggleLectureMode() {
    const lectureContainer = document.getElementById('lecture-mode-container');
    if (lectureContainer) {
        lectureContainer.classList.toggle('active');
    }
}