import { describe, expect, test } from "bun:test";
import { sapOperationText } from "./sap-operation-text";

describe("SAP Operation Short Text", () => {
  test("matches the requested example", () => {
    expect(sapOperationText("من بنها إلى العباسية وصول إلى التجمع الخامس من الرحاب إلى الشروق"))
      .toBe("بنها-العباسية-التجمع-الرحاب-الشروق");
  });

  test("includes the initial route before all additional routes", () => {
    expect(sapOperationText("من بنها إلى العباسية", ["وصول إلى التجمع الخامس", "من الرحاب إلى الشروق"]))
      .toBe("بنها-العباسية-التجمع-الرحاب-الشروق");
  });

  test("preserves compound names and letters within names", () => {
    expect(sapOperationText("من المنصورة الى كفر الشيخ", ["من شبين الكوم الي طنطا"]))
      .toBe("المنصورة-كفر الشيخ-شبين الكوم-طنطا");
  });

  test("handles missing routes and existing separators", () => {
    expect(sapOperationText(null, [" - بنها -- إلى الشروق - ", null])).toBe("بنها-الشروق");
    expect(sapOperationText(undefined)).toBe("");
  });

  test("limits the final text to 40 characters", () => {
    expect(sapOperationText("مدينة طويلة ".repeat(10))).toHaveLength(40);
  });
});