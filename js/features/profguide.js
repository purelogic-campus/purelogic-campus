// js/features/profguide.js
export function openProfGuideModal() {
    const modal = document.getElementById('prof-guide-modal');
    if (modal) {
        modal.style.display = 'block';
    }
}

export function closeProfGuideModal() {
    const modal = document.getElementById('prof-guide-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}