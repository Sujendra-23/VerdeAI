import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "../../src/components/Sidebar";
import { useUiStore } from "../../src/store/uiStore";

function renderWithProviders() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Sidebar />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useUiStore.setState({ restaurantId: "R001", date: "2026-02-05", activeTab: "forecast" });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { restaurantId: "R001", name: "Verde Kitchen — Downtown", location: "Seattle, WA" },
      ],
    }),
  );
});

describe("Sidebar", () => {
  it("switches the active tab in the shared UI store when a nav item is clicked", async () => {
    renderWithProviders();
    await userEvent.click(await screen.findByRole("button", { name: /waste risk/i }));
    expect(useUiStore.getState().activeTab).toBe("waste-risk");
  });

  it("updates the selected restaurant when the dropdown changes", async () => {
    renderWithProviders();
    const select = await screen.findByLabelText(/restaurant/i);
    await screen.findByText("Verde Kitchen — Downtown");
    await userEvent.selectOptions(select, "R001");
    expect(useUiStore.getState().restaurantId).toBe("R001");
  });
});
