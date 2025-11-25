import { NextResponse } from "next/server";

export async function GET() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  if (!config.apiKey || !config.projectId || !config.appId) {
    return NextResponse.json(
      {
        success: false,
        errorCode: "FIREBASE_NOT_CONFIGURED",
        message:
          "Firebase web configuration is incomplete. Please set NEXT_PUBLIC_FIREBASE_* environment variables.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json(config);
}


