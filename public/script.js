const uploadForm = document.getElementById("uploadForm");
const scriptLinkContainer = document.getElementById("scriptLinkContainer");
const askButton = document.getElementById("askButton");
let dynamicScriptId = null;

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(uploadForm);

  try {
    const response = await fetch("http://localhost:8080/upload", {
      method: "POST",
      body: formData,
    });
    const data = await response.json();
    dynamicScriptId = data.scriptId;

    // Display the script link for embedding
    scriptLinkContainer.innerHTML = `
      <p>Embed this script in your application:</p>
      <pre>&lt;script src="http://localhost:8080/ask/${dynamicScriptId}"&gt;&lt;/script&gt;</pre>
    `;

    // Show the "Ask Me Anything" button
    askButton.style.display = "block";
  } catch (error) {
    console.error("File upload error:", error);
    alert("Error uploading the file. Please try again.");
  }
});

// Add functionality to the "Ask Me Anything" button
askButton.addEventListener("click", () => {
  // Greeting
  const greeting = new SpeechSynthesisUtterance("How can I help you?");
  window.speechSynthesis.speak(greeting);

  // Start listening
  setTimeout(() => {
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = "en-US";
    recognition.maxResults = 1;

    recognition.onresult = async (event) => {
      const question = event.results[0][0].transcript;
      try {
        const response = await fetch(`http://localhost:8080/process-speech/${dynamicScriptId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ question }),
        });
        const data = await response.json();
        const answer = new SpeechSynthesisUtterance(data.answer);
        window.speechSynthesis.speak(answer);
      } catch (error) {
        console.error("Error processing speech:", error);
      }
    };

    recognition.onerror = (err) => {
      console.error("Speech recognition error:", err);
    };

    recognition.start();
  }, 1000);
});
