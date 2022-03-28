import * as tb from "../../infer/type-builders";
import * as tt from "../../infer/type-types";
import { getOperationType } from "../graphql";

describe("getOperationType", () => {
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

    const resultType = getOperationType(query, ctx);

    expect(tt.print(resultType, true)).toMatchInlineSnapshot(`
    "GqlOperation<
      {
        droid: {
          name: string,
          appearsIn: Array<\\"NEWHOPE\\" | \\"EMPIRE\\" | \\"JEDI\\">
        }
      },
      {
        id: string
      }
    >"
    `);
  });
});
