const surpriseSection = document.getElementById('surprise');

const randomTime = Math.random() * 4000;

setTimeout(() => {
    surpriseSection.textContent = '🎉 Surprise! 🎉';
}, randomTime);