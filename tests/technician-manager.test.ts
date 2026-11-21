import { describe, it, expect } from "vitest";
import { autoManagerForTechnician } from "../src/lib/technician-manager";

const links = [
  { technician_id: "t1", manager_id: "m1" },
  { technician_id: "t2", manager_id: "m1" },
  { technician_id: "t2", manager_id: "m2" },
];

describe("autoManagerForTechnician", () => {
  it("يعيد المدير الوحيد عندما يكون للفني مدير واحد", () => {
    expect(autoManagerForTechnician("t1", links)).toBe("m1");
  });

  it("يعيد null عندما يكون للفني أكثر من مدير (تُترك الخانة فارغة)", () => {
    expect(autoManagerForTechnician("t2", links)).toBeNull();
  });

  it("يعيد null عندما لا يوجد مدير مرتبط بالفني", () => {
    expect(autoManagerForTechnician("t3", links)).toBeNull();
  });

  it("يعيد null عند اختيار لا يوجد أو عدم اختيار فني", () => {
    expect(autoManagerForTechnician("__none__", links)).toBeNull();
    expect(autoManagerForTechnician("", links)).toBeNull();
    expect(autoManagerForTechnician(null, links)).toBeNull();
  });

  it("يتجاهل الروابط المكررة لنفس المدير", () => {
    const dup = [
      { technician_id: "t1", manager_id: "m1" },
      { technician_id: "t1", manager_id: "m1" },
    ];
    expect(autoManagerForTechnician("t1", dup)).toBe("m1");
  });

  it("يعيد null عند غياب قائمة الروابط", () => {
    expect(autoManagerForTechnician("t1", null)).toBeNull();
  });
});
