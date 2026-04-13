import "dotenv/config";
import { google } from "googleapis";
import { Readable } from "stream";

const SCOPES = ["https://www.googleapis.com/auth/drive.file"];

function getDriveClient() {
  const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!clientEmail) {
    throw new Error("Variável GOOGLE_DRIVE_CLIENT_EMAIL não configurada no .env");
  }
  if (!privateKey) {
    throw new Error("Variável GOOGLE_DRIVE_PRIVATE_KEY não configurada no .env");
  }
  if (!folderId) {
    throw new Error(
      "Variável GOOGLE_DRIVE_FOLDER_ID não configurada no .env. " +
      "Service Accounts não têm quota própria — o arquivo precisa ir para uma pasta " +
      "de um Google Drive real, compartilhada com a conta de serviço.",
    );
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: SCOPES,
  });

  return { drive: google.drive({ version: "v3", auth }), folderId };
}

export type DriveUploadResult = {
  fileId: string;
  fileName: string;
  webViewLink: string;
};

/** Upload usando o access token OAuth2 do próprio usuário (sem service account). */
export async function uploadPdfToDriveWithToken(args: {
  pdfBuffer: Buffer;
  fileName: string;
  folderId: string;
  accessToken: string;
}): Promise<DriveUploadResult> {
  const oauth2 = new google.auth.OAuth2();
  oauth2.setCredentials({ access_token: args.accessToken });

  const drive = google.drive({ version: "v3", auth: oauth2 });

  const response = await drive.files.create({
    requestBody: {
      name: args.fileName,
      mimeType: "application/pdf",
      parents: [args.folderId],
    },
    media: {
      mimeType: "application/pdf",
      body: Readable.from(args.pdfBuffer),
    },
    fields: "id,webViewLink",
  });

  const { id, webViewLink } = response.data;

  if (!id || !webViewLink) {
    throw new Error("Upload para o Drive falhou: resposta sem ID ou link");
  }

  return { fileId: id, fileName: args.fileName, webViewLink };
}

export async function uploadPdfToDrive(args: {
  pdfBuffer: Buffer;
  fileName: string;
}): Promise<DriveUploadResult> {
  const { drive, folderId } = getDriveClient();

  const fileMetadata: Record<string, unknown> = {
    name: args.fileName,
    mimeType: "application/pdf",
    parents: [folderId],
  };

  const response = await drive.files.create({
    requestBody: fileMetadata,
    media: {
      mimeType: "application/pdf",
      body: Readable.from(args.pdfBuffer),
    },
    fields: "id,webViewLink",
  });

  const { id, webViewLink } = response.data;

  if (!id || !webViewLink) {
    throw new Error(
      "Upload para o Drive falhou: resposta sem ID ou link do arquivo",
    );
  }

  return { fileId: id, fileName: args.fileName, webViewLink };
}
