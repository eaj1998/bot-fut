import swaggerSpec from './config/swagger.config';
import fs from 'fs';
import path from 'path';

// Export Swagger spec to JSON file
const outputPath = path.join(__dirname, '../bruno-collection/openapi.json');
const outputDir = path.dirname(outputPath);

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(outputPath, JSON.stringify(swaggerSpec, null, 2));

console.log(`✅ OpenAPI spec exported to: ${outputPath}`);
console.log('You can now import this file into Bruno!');
