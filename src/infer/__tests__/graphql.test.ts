import * as tb from "../../infer/type-builders";
import * as tt from "../../infer/type-types";
import { getResultType } from "../graphql";

describe.only("getResultType", () => {
  it("should return the type of the query", () => {
    const ctx = tb.createCtx();
    const query = `
      query DroidById($id: ID!) {
        droid(id: $id) {
          name
          appearsIn
        }
      }
    `;

    const resultType = getResultType(query, ctx);

    expect(tt.print(resultType)).toMatchInlineSnapshot(
      `"{droid: {name: string, appearsIn: Array<\\"NEWHOPE\\" | \\"EMPIRE\\" | \\"JEDI\\">}}"`
    );
  });
});
