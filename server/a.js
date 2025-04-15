const fs = require('fs');
const pdf = require('pdf-parse');

const filePath = './contracts_files/1744612705419-159912386-dummy.pdf';

async function extractTextFromPDF(filePath) {
    try {
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdf(dataBuffer);
        return data.text;
    } catch (error) {
        console.error('Error extracting PDF text:', error);
        throw error;
    }
}

(async () => {
    const text = await extractTextFromPDF(filePath);
    console.log(text);
  })();