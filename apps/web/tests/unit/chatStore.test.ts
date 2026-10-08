import { beforeEach, describe, expect, it } from "vitest";
import { useChatStore } from "../../src/store/chatStore";

beforeEach(() => {
  useChatStore.setState({ messagesByKey: {}, isSending: false });
});

describe("chatStore", () => {
  it("starts with no messages for a key it hasn't seen", () => {
    expect(useChatStore.getState().getMessages("R001:2026-02-05")).toEqual([]);
  });

  it("appends messages under their restaurant/date key without touching other keys", () => {
    const { addMessage } = useChatStore.getState();
    addMessage("R001:2026-02-05", { role: "assistant", content: "Hello" });
    addMessage("R002:2026-02-05", { role: "assistant", content: "Different restaurant" });

    expect(useChatStore.getState().getMessages("R001:2026-02-05")).toEqual([
      { role: "assistant", content: "Hello" },
    ]);
    expect(useChatStore.getState().getMessages("R002:2026-02-05")).toHaveLength(1);
  });

  it("reset clears only the given key's history", () => {
    const { addMessage, reset } = useChatStore.getState();
    addMessage("R001:2026-02-05", { role: "user", content: "Hi" });
    addMessage("R002:2026-02-05", { role: "user", content: "Hi" });
    reset("R001:2026-02-05");

    expect(useChatStore.getState().getMessages("R001:2026-02-05")).toEqual([]);
    expect(useChatStore.getState().getMessages("R002:2026-02-05")).toHaveLength(1);
  });
});

describe("chatStore selectors", () => {
  it("returns the same array for an empty thread so selectors don't re-render forever", () => {
    const { getMessages } = useChatStore.getState();
    expect(getMessages("R001:2026-02-05")).toBe(getMessages("R001:2026-02-05"));
  });
});
