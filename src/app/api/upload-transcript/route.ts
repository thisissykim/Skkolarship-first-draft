import { NextResponse } from "next/server";

const UPSTAGE_URL = "https://api.upstage.ai/v1/document-digitization";

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, message: "파일이 필요합니다." }, { status: 400 });
  }

  const apiKey = process.env.UPSTAGE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        ok: true,
        extraction: {
          student_id: "",
          name: "",
          grade_level: null,
          major: "",
          semester_gpa: null,
          cumulative_gpa: null,
          credits_completed: null,
        },
        rawExtraction: {
          mock: true,
          note: "UPSTAGE_API_KEY가 없어 mock 응답을 반환했습니다.",
        },
      },
      { status: 200 },
    );
  }

  const upstageForm = new FormData();
  upstageForm.append("document", file);
  upstageForm.append("ocr", "force");
  upstageForm.append("base64_encoding", "['table']");
  upstageForm.append("model", "document-parse");

  const response = await fetch(UPSTAGE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: upstageForm,
  });

  if (!response.ok) {
    return NextResponse.json(
      { ok: false, message: "성적증명서 분석에 실패했습니다." },
      { status: 502 },
    );
  }

  const rawExtraction = (await response.json()) as Record<string, unknown>;
  const extraction = normalizeExtraction(rawExtraction);

  return NextResponse.json({
    ok: true,
    extraction,
    rawExtraction,
  });
}

function normalizeExtraction(rawExtraction: Record<string, unknown>) {
  const fields = (rawExtraction as { extracted?: Record<string, unknown> }).extracted ?? rawExtraction;
  return {
    student_id: toStringValue(fields.student_id),
    name: toStringValue(fields.name),
    grade_level: toNumberValue(fields.grade_level),
    major: toStringValue(fields.major),
    semester_gpa: toNumberValue(fields.semester_gpa),
    cumulative_gpa: toNumberValue(fields.cumulative_gpa),
    credits_completed: toNumberValue(fields.credits_completed),
  };
}

function toStringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function toNumberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}
