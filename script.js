document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const capturedImage = document.getElementById('captured-image');
    const cameraOff = document.getElementById('camera-off');
    const cameraOverlay = document.getElementById('camera-overlay');
    const permissionError = document.getElementById('permission-error');
    const timestampElement = document.getElementById('timestamp');
    const gpsElement = document.getElementById('gps-coords');
    
    // Buttons
    const startCameraBtn = document.getElementById('start-camera');
    const capturePhotoBtn = document.getElementById('capture-photo');
    const stopCameraBtn = document.getElementById('stop-camera');
    const newPhotoBtn = document.getElementById('new-photo');
    const switchCameraBtn = document.getElementById('switch-camera');
    const downloadContainer = document.getElementById('download-container');
    const downloadLink = document.getElementById('download-link');
    
    // State variables
    let stream = null;
    let currentAddress = "Acquiring location...";
    let locationInterval;
    let timestampInterval;
    let addressCache = {};
    const LOCATIONIQ_API_KEY = 'pk.aba82bcb0fe292e664fff29d7ee9ce5f';
    let usingFrontCamera = false;

    // Enhanced timestamp with timezone
    function updateTimestamp() {
        const now = new Date();
        timestampElement.textContent = now.toLocaleString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZoneName: 'short'
        });
    }

    // Address formatter with validation
    function formatAddress(addr) {
        if (!addr) return "Location details not available";
        
        const isValidAddress = addr.road || addr.building || addr.amenity || 
                             addr.neighbourhood || addr.suburb || 
                             addr.city || addr.town || addr.village;
        
        if (!isValidAddress) return "Precise location not available";

        let addressParts = [];
        if (addr.building) addressParts.push(addr.building);
        else if (addr.amenity) addressParts.push(addr.amenity);
        
        if (addr.road) {
            if (addr.house_number) addressParts.push(`${addr.house_number} ${addr.road}`);
            else addressParts.push(addr.road);
        }
        
        if (addr.neighbourhood && !addr.neighbourhood.match(/^Ward \d+$/i)) {
            addressParts.push(addr.neighbourhood);
        }
        if (addr.suburb) addressParts.push(addr.suburb);
        
        if (addr.city || addr.town || addr.village) {
            addressParts.push(addr.city || addr.town || addr.village);
        }
        
        if (addr.state_district && addr.state_district !== addr.city) {
            addressParts.push(addr.state_district);
        }
        if (addr.state) addressParts.push(addr.state);
        if (addr.postcode) addressParts.push(addr.postcode);
        if (addr.country) addressParts.push(addr.country);
        
        return addressParts.join(", ");
    }

    // LocationIQ geocoding
    async function getPreciseAddress(latitude, longitude) {
        const cacheKey = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
        
        if (addressCache[cacheKey]) {
            return addressCache[cacheKey];
        }
        
        try {
            const response = await fetch(
                `https://us1.locationiq.com/v1/reverse.php?key=${LOCATIONIQ_API_KEY}&lat=${latitude}&lon=${longitude}&format=json&zoom=18&addressdetails=1`
            );
            
            if (!response.ok) {
                throw new Error(`LocationIQ error: ${response.status}`);
            }
            
            const data = await response.json();
            const address = formatAddress(data.address);
            
            if (address && !address.includes("not available")) {
                addressCache[cacheKey] = address;
                return address;
            }
            
            return "Precise location unavailable";
        } catch (error) {
            console.error("Geocoding error:", error);
            return "Could not retrieve address";
        }
    }

    // Start camera with specified facing mode
    async function startCamera(facingMode = 'environment') {
        try {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            
            stream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    facingMode: facingMode,
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                },
                audio: false
            });
            
            video.srcObject = stream;
            usingFrontCamera = facingMode === 'user';
            
            video.classList.remove('hidden');
            cameraOff.classList.add('hidden');
            cameraOverlay.classList.remove('hidden');
            
            startCameraBtn.classList.add('hidden');
            capturePhotoBtn.classList.remove('hidden');
            stopCameraBtn.classList.remove('hidden');
            switchCameraBtn.classList.remove('hidden');
            
            capturedImage.classList.add('hidden');
            downloadContainer.classList.add('hidden');
            
            await updateLocation();
            locationInterval = setInterval(updateLocation, 30000);
            timestampInterval = setInterval(updateTimestamp, 1000);
            
        } catch (err) {
            console.error('Camera error:', err);
            permissionError.classList.remove('hidden');
        }
    }

    // Switch between front and back camera
    function switchCamera() {
        const newFacingMode = usingFrontCamera ? 'environment' : 'user';
        startCamera(newFacingMode);
    }

    // High-accuracy location updates
    async function updateLocation() {
        if (!navigator.geolocation) {
            gpsElement.textContent = "Geolocation not supported";
            return;
        }

        return new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude, accuracy } = position.coords;
                    
                    if (accuracy > 100) {
                        gpsElement.textContent = `Approximate location (${Math.round(accuracy)}m)`;
                    } else {
                        gpsElement.textContent = `Precise location (${Math.round(accuracy)}m)`;
                    }
                    
                    try {
                        currentAddress = await getPreciseAddress(latitude, longitude);
                        gpsElement.textContent = `Location: ${currentAddress}`;
                        updateTimestamp();
                    } catch (error) {
                        console.error("Address lookup error:", error);
                        gpsElement.textContent = "Getting precise address...";
                    }
                    resolve();
                },
                (error) => {
                    console.error("Geolocation error:", error);
                    gpsElement.textContent = "Enable location for address";
                    resolve();
                },
                { 
                    enableHighAccuracy: true,
                    timeout: 15000,
                    maximumAge: 0
                }
            );
        });
    }
    
    // Stop camera
    function stopCamera() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            video.srcObject = null;
            stream = null;
        }
        
        clearInterval(locationInterval);
        clearInterval(timestampInterval);
        
        video.classList.add('hidden');
        cameraOff.classList.remove('hidden');
        cameraOverlay.classList.add('hidden');
        
        startCameraBtn.classList.remove('hidden');
        capturePhotoBtn.classList.add('hidden');
        stopCameraBtn.classList.add('hidden');
        switchCameraBtn.classList.add('hidden');
    }
    
    // Capture photo
    function capturePhoto() {
        const context = canvas.getContext('2d');
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const logoWidth = canvas.width * 0.15;
        const logoHeight = logoWidth;
        const logoY = canvas.height * 0.1;
        
        const iemLogo = new Image();
        iemLogo.crossOrigin = "anonymous";
        iemLogo.onload = () => {
            context.drawImage(iemLogo, canvas.width * 0.05, logoY-40, logoWidth-7, logoHeight-10);
            
            const uemLogo = new Image();
            uemLogo.crossOrigin = "anonymous";
            uemLogo.onload = () => {
                context.drawImage(uemLogo, canvas.width * 0.8, logoY-30, logoWidth-9, logoHeight-18);
                
                context.fillStyle = "rgba(0, 0, 0, 0.5)";
                context.fillRect(0, canvas.height - 80, canvas.width, 80);
                
                context.fillStyle = "white";
                context.font = "bold 14px Arial";
                
                const date = new Date();
                const timestamp = date.toLocaleString('en-US', {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    timeZoneName: 'short'
                });
                context.fillText(`Captured: ${timestamp}`, 10, canvas.height - 60);
                
                context.font = "13px Arial";
                const addressLines = splitAddressLines(currentAddress, canvas.width - 20, context);
                addressLines.forEach((line, index) => {
                    context.fillText(line, 10, canvas.height - 40 + (index * 15));
                });
                
                const imageDataUrl = canvas.toDataURL('image/png');
                capturedImage.src = imageDataUrl;
                capturedImage.classList.remove('hidden');
                video.classList.add('hidden');
                
                downloadLink.href = imageDataUrl;
                downloadLink.download = `gps-photo-${Date.now()}.png`;
                downloadContainer.classList.remove('hidden');
                
                newPhotoBtn.classList.remove('hidden');
                capturePhotoBtn.classList.add('hidden');
                switchCameraBtn.classList.add('hidden');
            };
            uemLogo.src = 'uem-logo.png';
        };
        iemLogo.src = 'iem-logo.png';
    }
    
    function splitAddressLines(address, maxWidth, context) {
        const lines = [];
        let currentLine = '';
        
        address.split(', ').forEach(part => {
            const testLine = currentLine ? `${currentLine}, ${part}` : part;
            const metrics = context.measureText(testLine);
            
            if (metrics.width < maxWidth) {
                currentLine = testLine;
            } else {
                if (currentLine) lines.push(currentLine);
                currentLine = part;
            }
        });
        
        if (currentLine) lines.push(currentLine);
        return lines;
    }
    
    function resetForNewPhoto() {
        capturedImage.classList.add('hidden');
        video.classList.remove('hidden');
        newPhotoBtn.classList.add('hidden');
        capturePhotoBtn.classList.remove('hidden');
        switchCameraBtn.classList.remove('hidden');
        downloadContainer.classList.add('hidden');
    }
    
    // Event listeners
    startCameraBtn.addEventListener('click', () => startCamera('environment'));
    stopCameraBtn.addEventListener('click', stopCamera);
    capturePhotoBtn.addEventListener('click', capturePhoto);
    newPhotoBtn.addEventListener('click', resetForNewPhoto);
    switchCameraBtn.addEventListener('click', switchCamera);
});
