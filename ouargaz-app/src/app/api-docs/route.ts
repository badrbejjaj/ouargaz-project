import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const html = `
<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Documentation API - OUARGAZ</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />
    <link rel="icon" type="image/png" href="https://unpkg.com/swagger-ui-dist@5.11.0/favicon-32x32.png" sizes="32x32" />
    <style>
      html {
        box-sizing: border-box;
        overflow: -inherit;
      }
      *, *:before, *:after {
        box-sizing: inherit;
      }
      body {
        margin: 0;
        background: #fafafa;
      }
      .swagger-ui .topbar {
        background-color: #111827;
        padding: 10px 0;
      }
      .swagger-ui .topbar .download-url-wrapper input[type=text] {
        border: 2px solid #DA1A1A;
        border-radius: 4px 0 0 4px;
      }
      .swagger-ui .topbar .download-url-wrapper .download-url-button {
        background: #DA1A1A;
        border-radius: 0 4px 4px 0;
      }
      .swagger-ui .info .title {
        color: #111827;
      }
      .swagger-ui .opblock.opblock-post .opblock-summary-method {
        background: #DA1A1A;
      }
      .swagger-ui .opblock.opblock-post {
        border-color: #DA1A1A;
        background: rgba(218, 26, 26, 0.05);
      }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js" charset="UTF-8"></script>
    <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-standalone-preset.js" charset="UTF-8"></script>
    <script>
      window.onload = () => {
        window.ui = SwaggerUIBundle({
          url: '/docs/openapi.json',
          dom_id: '#swagger-ui',
          deepLinking: true,
          presets: [
            SwaggerUIBundle.presets.apis,
            SwaggerUIStandalonePreset
          ],
          layout: "StandaloneLayout",
          plugins: [
            SwaggerUIBundle.plugins.DownloadUrl
          ]
        });
      };
    </script>
  </body>
</html>
  `
  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  })
}
