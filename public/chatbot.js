(function () {
    // Create floating button
    const bubble = document.createElement("div");
    bubble.id = "gps-chatbot-bubble";

    bubble.style.position = "fixed";
    bubble.style.bottom = "20px";
    bubble.style.right = "20px";
    bubble.style.width = "55px";
    bubble.style.height = "55px";
    bubble.style.background = "#436CFF";
    bubble.style.borderRadius = "50%";
    bubble.style.display = "flex";
    bubble.style.alignItems = "center";
    bubble.style.justifyContent = "center";
    bubble.style.boxShadow = "0 6px 20px rgba(0,0,0,0.25)";
    bubble.style.cursor = "pointer";
    bubble.style.zIndex = "9999";
    bubble.style.color = "white";
    bubble.style.fontSize = "26px";
    bubble.innerHTML = "💬";

    document.body.appendChild(bubble);

    // Create iframe chatbot window
    const iframe = document.createElement("iframe");
    iframe.src = "/chatbot_widget.html";
    iframe.id = "gps-chatbot-iframe";
    iframe.style.position = "fixed";
    iframe.style.bottom = "90px";
    iframe.style.right = "20px";
    iframe.style.width = "380px";
    iframe.style.height = "600px";
    iframe.style.border = "none";
    iframe.style.borderRadius = "15px";
    iframe.style.boxShadow = "0 8px 30px rgba(0,0,0,0.3)";
    iframe.style.zIndex = "9998";
    iframe.style.display = "none";
    iframe.style.transition = "opacity 0.3s ease";

    document.body.appendChild(iframe);

    // Toggle chatbot
    bubble.onclick = () => {
        const isVisible = iframe.style.display === "block";
        if (isVisible) {
            iframe.style.opacity = "0";
            setTimeout(() => {
                iframe.style.display = "none";
            }, 300);
        } else {
            iframe.style.display = "block";
            iframe.style.opacity = "0";
            setTimeout(() => {
                iframe.style.opacity = "1";
            }, 10);
        }
    };

    // Close on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && iframe.style.display === "block") {
            bubble.onclick();
        }
    });
})();
