const form = document.getElementById("convert-form");
const input = document.getElementById("pdf-input");
const dropZone = document.getElementById("drop-zone");
const browseButton = document.getElementById("browse-button");
const preview = document.getElementById("file-preview");
const fileName = document.getElementById("file-name");
const fileSize = document.getElementById("file-size");
const removeButton = document.getElementById("remove-file");
const pagesSelect = document.getElementById("pages-select");
const customPages = document.getElementById("custom-pages");
const convertButton = document.getElementById("convert-button");
const progressArea = document.getElementById("progress-area");
const statusMessage = document.getElementById("status-message");

let selectedFile = null;

function showMessage(message, type = "error") {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
  statusMessage.classList.remove("hidden");
}

function clearMessage() {
  statusMessage.classList.add("hidden");
  statusMessage.textContent = "";
}

function setFile(file) {
  clearMessage();
  if (!file) return;
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) {
    showMessage("Please choose a PDF file.");
    return;
  }
  if (file.size > 50 * 1024 * 1024) {
    showMessage("This file is larger than 50 MB. Please choose a smaller PDF.");
    return;
  }
  if (file.size === 0) {
    showMessage("This file is empty. Please choose another PDF.");
    return;
  }
  selectedFile = file;
  fileName.textContent = file.name;
  fileSize.textContent = formatBytes(file.size);
  preview.classList.remove("hidden");
  dropZone.classList.add("has-file");
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

browseButton.addEventListener("click", () => input.click());
dropZone.addEventListener("click", (event) => {
  if (event.target.closest("button")) return;
  input.click();
});
dropZone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    input.click();
  }
});
input.addEventListener("change", () => setFile(input.files[0]));

["dragenter", "dragover"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add("dragover");
  });
});
["dragleave", "drop"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove("dragover");
  });
});
dropZone.addEventListener("drop", (event) => {
  const file = event.dataTransfer.files[0];
  setFile(file);
});

removeButton.addEventListener("click", () => {
  selectedFile = null;
  input.value = "";
  preview.classList.add("hidden");
  clearMessage();
});

pagesSelect.addEventListener("change", () => {
  const custom = pagesSelect.value === "custom";
  customPages.classList.toggle("hidden", !custom);
  customPages.required = custom;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();

  if (!selectedFile) {
    showMessage("Please upload a PDF file first.");
    return;
  }

  const data = new FormData();
  data.append("pdf", selectedFile);
  data.append("dpi", document.getElementById("dpi-select").value);
  data.append("quality", document.getElementById("quality-select").value);

  if (pagesSelect.value === "custom") {
    const pageValue = customPages.value.trim();
    if (!pageValue) {
      showMessage("Enter the page numbers you want to convert.");
      customPages.focus();
      return;
    }
    data.append("pages", pageValue);
  } else {
    data.append("pages", "all");
  }

  convertButton.disabled = true;
  convertButton.querySelector("span").textContent = "Converting...";
  progressArea.classList.remove("hidden");

  try {
    const response = await fetch("/api/convert", { method: "POST", body: data });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || "Conversion failed. Please try again.");
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = makeDownloadName(selectedFile.name);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showMessage("Your JPG images are ready. The ZIP download has started.", "success");
  } catch (error) {
    showMessage(error.message || "Something went wrong. Please try again.");
  } finally {
    progressArea.classList.add("hidden");
    convertButton.disabled = false;
    convertButton.querySelector("span").textContent = "Convert to JPG";
  }
});

function makeDownloadName(name) {
  const stem = name.replace(/\.pdf$/i, "").replace(/[^\w.-]+/g, "_");
  return `${stem || "converted"}-jpg-images.zip`;
}
