export function triggerConfetti() {
  if (typeof window === "undefined") return;
  const colors = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"];
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.top = "0";
  container.style.left = "0";
  container.style.width = "100vw";
  container.style.height = "100vh";
  container.style.pointerEvents = "none";
  container.style.zIndex = "999999";
  container.style.overflow = "hidden";
  document.body.appendChild(container);

  for (let i = 0; i < 100; i++) {
    const confetti = document.createElement("div");
    confetti.style.position = "absolute";
    confetti.style.width = `${Math.random() * 8 + 6}px`;
    confetti.style.height = `${Math.random() * 12 + 6}px`;
    confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.left = `${Math.random() * 100}vw`;
    confetti.style.top = `-20px`;
    confetti.style.opacity = Math.random().toString();
    confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
    confetti.style.borderRadius = Math.random() > 0.5 ? "50%" : "2px";
    
    // Add custom animation
    const duration = Math.random() * 3 + 2; // 2s - 5s
    const delay = Math.random() * 1.5;
    confetti.style.animation = `confettiFall ${duration}s linear ${delay}s forwards`;
    
    container.appendChild(confetti);
  }

  setTimeout(() => {
    container.remove();
  }, 7000);
}
