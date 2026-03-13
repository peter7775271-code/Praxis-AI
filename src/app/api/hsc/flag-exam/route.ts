import { supabaseAdmin } from "@/lib/db";

const VALID_FLAGS = ["needs_images", "needs_review", null] as const;
type ReviewFlag = (typeof VALID_FLAGS)[number];

/**
 * POST /api/hsc/flag-exam
 *
 * Developer-only endpoint. Sets or clears the review_flag on all questions
 * belonging to the specified exam (identified by schoolName + year + subject
 * + paperNumber).
 *
 * Body: {
 *   schoolName: string | null,
 *   year: number,
 *   subject: string,
 *   paperNumber: number,
 *   flag: "needs_images" | "needs_review" | null
 * }
 *
 * Required database column (add once in Supabase SQL editor):
 *   ALTER TABLE hsc_questions
 *     ADD COLUMN IF NOT EXISTS review_flag TEXT
 *     CHECK (review_flag IN ('needs_images', 'needs_review'));
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { schoolName, year, subject, paperNumber, flag } = body as {
      schoolName: string | null;
      year: number;
      subject: string;
      paperNumber: number;
      flag: ReviewFlag;
    };

    if (flag !== null && flag !== "needs_images" && flag !== "needs_review") {
      return Response.json(
        { error: "Invalid flag value — must be 'needs_images', 'needs_review', or null" },
        { status: 400 }
      );
    }

    if (!subject || !year) {
      return Response.json(
        { error: "Missing required fields: subject, year" },
        { status: 400 }
      );
    }

    let query = supabaseAdmin
      .from("hsc_questions")
      .update({ review_flag: flag })
      .eq("subject", subject)
      .eq("year", year)
      .eq("paper_number", paperNumber ?? 1);

    if (schoolName) {
      query = query.eq("school_name", schoolName);
    } else {
      query = query.is("school_name", null);
    }

    const { error } = await query;

    if (error) {
      if (/review_flag|column/.test(error.message ?? "")) {
        return Response.json(
          {
            error:
              "The review_flag column does not exist yet. Run this SQL in Supabase:\n" +
              "ALTER TABLE hsc_questions ADD COLUMN IF NOT EXISTS review_flag TEXT " +
              "CHECK (review_flag IN ('needs_images', 'needs_review'));",
            details: error.message,
          },
          { status: 422 }
        );
      }
      console.error("[flag-exam] Supabase error:", error.message);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[flag-exam] Error:", message);
    return Response.json({ error: "Internal server error", details: message }, { status: 500 });
  }
}
