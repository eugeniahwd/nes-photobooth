// Daftarkan Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('Service Worker registered!'))
      .catch(err => console.log('Error:', err));
  });
}

// Variabel global
let currentStep = 1;
let selectedLayout = null;
let selectedCountdown = 3;
let capturedFrames = [];
let videoStream = null;
let deferredPrompt;


// Elemen DOM
const steps = document.querySelectorAll('.step');
const layoutOptions = document.querySelectorAll('.layout-option');
const countdownSelect = document.getElementById('countdownSelect');
const nextBtn1 = document.getElementById('nextBtn1');
const nextBtn2 = document.getElementById('nextBtn2');
const startBtn = document.getElementById('startBtn');
const videoElement = document.getElementById('video');
const countdownDisplay = document.getElementById('countdownDisplay');
const progressBarFill = document.getElementById('progressBarFill');
const stripResult = document.getElementById('stripResult');
const downloadStrip = document.getElementById('downloadStrip');
const flash = document.getElementById('flash');
const newPhotoBtn = document.getElementById('newPhotoBtn');
const bgMusic = document.getElementById('bgMusic');
const musicToggle = document.getElementById('musicToggle');
const musicIcon = document.querySelector('.music-icon');
const muteIcon = document.querySelector('.mute-icon');

// Set volume dan looping
bgMusic.volume = 0.3;
bgMusic.loop = true;

// Handle autoplay policy
function startMusic() {
  const playPromise = bgMusic.play();
  
  if (playPromise !== undefined) {
    playPromise.catch(error => {
      // Autoplay prevented, show paused state
      musicIcon.style.display = 'none';
      muteIcon.style.display = 'block';
    });
  }
}

// Coba play saat pertama load
startMusic();

// Tambahkan fallback untuk mobile
document.addEventListener('click', function firstInteraction() {
  startMusic();
  document.removeEventListener('click', firstInteraction);
}, { once: true });

// Toggle control
musicToggle.addEventListener('click', () => {
  if (bgMusic.paused) {
    bgMusic.play();
    musicIcon.style.display = 'block';
    muteIcon.style.display = 'none';
  } else {
    bgMusic.pause();
    musicIcon.style.display = 'none';
    muteIcon.style.display = 'block';
  }
});


// PWA Installation
const installBtn = document.createElement('button');
installBtn.id = 'installBtn';
installBtn.className = 'install-button';
installBtn.textContent = 'Install App';
installBtn.style.display = 'none';

document.body.appendChild(installBtn);

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.style.display = 'block'; // Selalu tampilkan tombol
  
  installBtn.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User ${outcome} the install prompt`);
      // TIDAK menyembunyikan tombol setelah install
    }
  });
});

// Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('Service Worker registered'))
      .catch(err => console.log('Service Worker registration failed: ', err));
  });
}

// Inisialisasi
document.addEventListener('DOMContentLoaded', () => {
  // Set default countdown
  countdownSelect.value = selectedCountdown;
  
  // Initialize event listeners
  initEventListeners();

  newPhotoBtn.addEventListener('click', () => {
    goToStep(1); // Restart the process
  });
});

function initEventListeners() {
  // Layout selection
  layoutOptions.forEach(option => {
    option.addEventListener('click', () => {
      layoutOptions.forEach(opt => opt.classList.remove('selected'));
      option.classList.add('selected');
      selectedLayout = option.dataset.layout;
    });
  });

  // Countdown selection
  countdownSelect.addEventListener('change', () => {
    selectedCountdown = parseInt(countdownSelect.value);
  });

  // Navigation buttons
  nextBtn1.addEventListener('click', () => {
    if (!selectedLayout) {
      alert('Please select a layout first.');
      return;
    }
    goToStep(2);
  });

  nextBtn2.addEventListener('click', () => {
    goToStep(3);
  });

  // Start photo capture
  startBtn.addEventListener('click', startPhotoCapture);
}

// Step navigation
function goToStep(stepNumber) {
  steps[currentStep - 1].classList.remove('active');
  currentStep = stepNumber;
  steps[currentStep - 1].classList.add('active');
  
  if (currentStep === 3) {
    progressBarFill.style.width = '0%';
  }
}

// Start camera
async function startCamera() {
  try {
    videoStream = await navigator.mediaDevices.getUserMedia({ 
      video: { 
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user' 
      } 
    });
    videoElement.srcObject = videoStream;
    
    return new Promise(resolve => {
      videoElement.onloadedmetadata = () => {
        videoElement.play();
        resolve();
      };
    });
  } catch (error) {
    console.error("Camera error:", error);
    alert("Could not access the camera. Please make sure you've granted camera permissions.");
    throw error;
  }
}

// Start photo capture process
async function startPhotoCapture() {
  if (!videoStream) {
    try {
      await startCamera();
    } catch (error) {
      return;
    }
  }
  
  try {
    const totalFrames = selectedLayout === '3x1' ? 3 : 4;
    capturedFrames = [];
    
    for (let i = 0; i < totalFrames; i++) {
      await countdown(selectedCountdown);
      const frameDataUrl = await captureFrame();
      capturedFrames.push(frameDataUrl);
      progressBarFill.style.width = `${((i + 1) / totalFrames) * 100}%`;
    }
    
    // Generate and show results
    await generatePhotoStrip();
    goToStep(4);
    
    // Stop camera
    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
      videoStream = null;
    }
  } catch (error) {
    console.error("Capture error:", error);
    alert("An error occurred during capture. Please try again.");
  }
}

// Capture single frame
function captureFrame() {
  return new Promise(resolve => {
    // Trigger flash effect
    flash.style.opacity = 0.9;
    setTimeout(() => {
      flash.style.opacity = 0;
    }, 300);

    const canvas = document.createElement('canvas');
    // Maintain aspect ratio
    const aspectRatio = videoElement.videoWidth / videoElement.videoHeight;
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    
    const ctx = canvas.getContext('2d');
    
    // Remove mirror effect for saved photos
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    
    // Draw frame with rounded corners
    ctx.beginPath();
    ctx.roundRect(0, 0, canvas.width, canvas.height, 20);
    ctx.closePath();
    ctx.clip();
    
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    
    // Add some basic filter
    ctx.filter = 'contrast(1.1) brightness(1.05) saturate(1.1)';
    ctx.drawImage(canvas, 0, 0);
    ctx.filter = 'none';
    
    resolve(canvas.toDataURL('image/jpeg', 0.8));
  });
}

// Countdown timer
function countdown(seconds) {
  return new Promise(resolve => {
    countdownDisplay.textContent = seconds;
    let counter = seconds;
    
    const interval = setInterval(() => {
      counter--;
      countdownDisplay.textContent = counter;
      
      if (counter <= 0) {
        clearInterval(interval);
        countdownDisplay.textContent = 'SMILE!';
        setTimeout(() => {
          countdownDisplay.textContent = '';
          resolve();
        }, 500);
      }
    }, 1000);
  });
}

// Generate photo strip
function generatePhotoStrip() {
  return new Promise((resolve) => {
    const stripCanvas = document.createElement('canvas');
    const ctx = stripCanvas.getContext('2d');
    const frameCount = capturedFrames.length;
    const imgWidth = 350;
    const imgHeight = Math.round(imgWidth / (videoElement.videoWidth/videoElement.videoHeight)); // Maintain aspect ratio
    
    const padding = 15;
    const margin = 15;
    const textHeight = 40;
    
    stripCanvas.width = imgWidth + (margin * 2);
    stripCanvas.height = (imgHeight * frameCount) + (padding * (frameCount - 1)) + textHeight + 30;
    
    // Background gradient with rounded corners
    ctx.fillStyle = '#f1d2f9ff';
    ctx.fillRect(0, 0, stripCanvas.width, stripCanvas.height);
    
    let loadedImages = 0;
    
    capturedFrames.forEach((src, index) => {
      const img = new Image();
      img.src = src;
      img.onload = function() {
        const x = margin;
        const y = margin + (imgHeight + padding) * index;

        // Apply mirror effect for the strip
        ctx.save(); // Save the current context
        ctx.translate(x + imgWidth, y); // Move to the right edge of the image
        ctx.scale(-1, 1); // Flip horizontally
        
        ctx.drawImage(img, 0, 0, imgWidth, imgHeight); // Draw the image
        ctx.restore(); // Restore the context to avoid affecting other drawings
        
        loadedImages++;
        
        if (loadedImages === frameCount) {
          // Add text with hand script font
          ctx.fillStyle = '#000000ff';
          ctx.font = 'bold 28px "Parisienne", cursive';
          ctx.textAlign = 'center';
          ctx.fillText(
            "Agneesha's Birthday", 
            stripCanvas.width / 2, 
            stripCanvas.height - 20
          );
          
          const stripUrl = stripCanvas.toDataURL('image/png');
          stripResult.src = stripUrl;
          downloadStrip.href = stripUrl;
          resolve();
        }
      };
    });
  });
}
