import { NextRequest, NextResponse } from "next/server";

type GenerateNonceRequest = {
	beUrl: string;
	openTimestamp: string;
	openToken: string;
};

function buildTargetUrl(rawBaseUrl: string): string {
	const normalizedBaseUrl = rawBaseUrl.trim().replace(/\/+$/, "");
	return `${normalizedBaseUrl}/sdk/auth/generate-nonce-public-key`;
}

export async function POST(request: NextRequest) {
	let payload: Partial<GenerateNonceRequest>;

	try {
		payload = (await request.json()) as Partial<GenerateNonceRequest>;
	} catch {
		return NextResponse.json(
			{ message: "Invalid request body" },
			{ status: 400 }
		);
	}

	const { beUrl, openTimestamp, openToken } = payload;

	if (!beUrl || !openTimestamp || !openToken) {
		return NextResponse.json(
			{ message: "beUrl, openTimestamp, and openToken are required" },
			{ status: 400 }
		);
	}

	const targetUrl = buildTargetUrl(beUrl);

	try {
		new URL(targetUrl);
	} catch {
		return NextResponse.json(
			{ message: "Invalid backend URL" },
			{ status: 400 }
		);
	}

	try {
		const upstreamResponse = await fetch(targetUrl, {
			method: "GET",
			headers: {
				"X-Timestamp": openTimestamp,
				Authorization: `Bearer ${openToken}`,
			},
			cache: "no-store",
		});

		const rawBody = await upstreamResponse.text();
		const contentType = upstreamResponse.headers.get("content-type") || "";

		if (contentType.includes("application/json")) {
			try {
				const jsonBody = rawBody ? JSON.parse(rawBody) : {};
				return NextResponse.json(jsonBody, { status: upstreamResponse.status });
			} catch {
				return NextResponse.json(
					{ message: "Backend returned invalid JSON" },
					{ status: 502 }
				);
			}
		}

		return new NextResponse(rawBody, {
			status: upstreamResponse.status,
			headers: {
				"Content-Type": contentType || "text/plain; charset=utf-8",
			},
		});
	} catch {
		return NextResponse.json(
			{ message: "Unable to connect to backend from server" },
			{ status: 502 }
		);
	}
}
