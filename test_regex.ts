
const fileName = "Screenshot 2025-11-18 at 11.31.03 AM.png";
const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
console.log(`Original: ${fileName}`);
console.log(`Sanitized: ${sanitizedFileName}`);

if (sanitizedFileName === "Screenshot_2025-11-18_at_11.31.03_AM.png") {
    console.log("Verification PASSED");
} else {
    console.log("Verification FAILED");
}
