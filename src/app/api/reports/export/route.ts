import { NextRequest, NextResponse } from "next/server";
import { generateTaskReport, generatePDFReport, generateExcelReport } from "@/lib/actions/reports";
import { getWorkspace } from "@/lib/actions/workspaces";
import { getBoard } from "@/lib/actions/boards";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const format = searchParams.get("format") || "csv";
  const workspaceId = searchParams.get("workspaceId");
  const boardId = searchParams.get("boardId");
  
  // Parse filters from query params
  const filters: any = {};
  const dateFrom = searchParams.get("filters.dateRange.from");
  const dateTo = searchParams.get("filters.dateRange.to");
  if (dateFrom || dateTo) {
    filters.dateRange = {};
    if (dateFrom) filters.dateRange.from = dateFrom;
    if (dateTo) filters.dateRange.to = dateTo;
  }
  
  // Also try parsing as JSON if provided
  const filtersJson = searchParams.get("filters");
  if (filtersJson) {
    try {
      const parsed = JSON.parse(filtersJson);
      Object.assign(filters, parsed);
    } catch (e) {
      // Ignore parse errors
    }
  }
  
  const fields = searchParams.get("fields") || "all";

  if (!workspaceId && !boardId) {
    return NextResponse.json({ error: "Either workspaceId or boardId must be provided" }, { status: 400 });
  }

  try {
    // Get workspace/board names for branding
    let workspaceName: string | undefined;
    let boardName: string | undefined;

    if (workspaceId) {
      const workspace = await getWorkspace(workspaceId);
      workspaceName = workspace?.name;
    }

    if (boardId) {
      const board = await getBoard(boardId);
      boardName = board?.name;
    }

    if (format === "pdf") {
      const result = await generatePDFReport({
        workspaceId: workspaceId || undefined,
        boardId: boardId || undefined,
        filters,
        fields: fields === "all" ? "all" : JSON.parse(fields),
        workspaceName,
        boardName,
      });

      if (!result.success || !result.buffer) {
        return NextResponse.json({ error: result.error || "Failed to generate PDF" }, { status: 500 });
      }

      const filename = `report-${boardName || workspaceName || "export"}-${new Date().toISOString().split("T")[0]}.pdf`;

      return new NextResponse(result.buffer as unknown as BodyInit, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    } else if (format === "excel" || format === "xlsx") {
      const result = await generateExcelReport({
        workspaceId: workspaceId || undefined,
        boardId: boardId || undefined,
        filters,
        fields: fields === "all" ? "all" : JSON.parse(fields),
      });

      if (!result.success || !result.buffer) {
        return NextResponse.json({ error: result.error || "Failed to generate Excel" }, { status: 500 });
      }

      const filename = `report-${boardName || workspaceName || "export"}-${new Date().toISOString().split("T")[0]}.xlsx`;

      return new NextResponse(result.buffer as unknown as BodyInit, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    } else {
      // CSV (default)
      const result = await generateTaskReport({
        workspaceId: workspaceId || undefined,
        boardId: boardId || undefined,
        filters,
        fields: fields === "all" ? "all" : JSON.parse(fields),
      });

      if (!result.success || !result.csv) {
        return NextResponse.json({ error: result.error || "Failed to generate CSV" }, { status: 500 });
      }

      const filename = `report-${boardName || workspaceName || "export"}-${new Date().toISOString().split("T")[0]}.csv`;

      return new NextResponse(result.csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }
  } catch (error) {
    console.error("Error generating report:", error);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
