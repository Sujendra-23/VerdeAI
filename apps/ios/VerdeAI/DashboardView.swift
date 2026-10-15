import SwiftUI

struct DashboardView: View {
    @ObservedObject var model: DashboardModel
    @State private var selectedTab = 0
    @State private var filters = false
    @Environment(\.horizontalSizeClass) private var sizeClass
    private let labels = ["forecast", "wasteRisk", "explain"]
    private let symbols = ["chart.bar", "exclamationmark.triangle", "bubble.left.and.bubble.right"]

    var body: some View {
        Group {
            if sizeClass == .regular {
                NavigationSplitView {
                    List {
                        ForEach(labels.indices, id: \.self) { index in
                            Button { selectedTab = index } label: { Label(model.t(labels[index]), systemImage: symbols[index]) }
                                .listRowBackground(selectedTab == index ? Color.green.opacity(0.15) : Color.clear)
                        }
                    }.navigationTitle("VerdeAI")
                } detail: { screen(selectedTab) }
            } else {
                TabView(selection: $selectedTab) {
                    ForEach(labels.indices, id: \.self) { index in
                        screen(index).tabItem { Label(model.t(labels[index]), systemImage: symbols[index]) }.tag(index)
                    }
                }
            }
        }
        .sheet(isPresented: $filters) { filterSheet }
        .task { await model.bootstrap() }
        .task(id: model.contextKey) { await model.load() }
    }

    private func screen(_ tab: Int) -> some View {
        NavigationStack {
            Group {
                if tab == 2 { chat } else { records(tab) }
            }
            .navigationTitle(model.t(labels[tab]))
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { filters = true } label: { Image(systemName: "line.3.horizontal.decrease") }
                        .accessibilityLabel("\(model.t("restaurant")), \(model.t("date")), \(model.t("language"))")
                        .frame(minWidth: 44, minHeight: 44)
                }
            }
            .safeAreaInset(edge: .top, spacing: 0) {
                VStack(alignment: .leading, spacing: 6) {
                    Button { filters = true } label: {
                        HStack(alignment: .firstTextBaseline) {
                            Text(model.restaurants.first(where: { $0.id == model.restaurantId })?.name ?? "VerdeAI").font(.headline)
                            Spacer()
                            Image(systemName: "chevron.down").font(.caption)
                        }.frame(minHeight: 44)
                    }.buttonStyle(.plain)
                    Text(model.date, format: .dateTime.year().month(.abbreviated).day()).font(.subheadline).foregroundStyle(.secondary)
                    if let health = model.health { Text(model.t(health.dataSource == "mock" ? "demo" : "live")).font(.caption).foregroundStyle(health.dataSource == "mock" ? .yellow : .green) }
                }.padding(.horizontal).padding(.bottom, 12).background(.background)
            }
        }
    }

    @ViewBuilder private var status: some View {
        if model.startupError || model.loadError {
            Section {
                Label(model.t("loadError"), systemImage: "wifi.exclamationmark").foregroundStyle(.red)
                Button(model.t("retry")) { Task { await model.refresh() } }.frame(minHeight: 44)
            }
        } else if model.loading {
            Section { ProgressView(model.t("loadingInsight")).frame(maxWidth: .infinity, minHeight: 80) }
        }
    }

    private func records(_ tab: Int) -> some View {
        List {
            status
            if !model.loading && !model.loadError && !model.startupError {
                if tab == 0 {
                    if model.insight?.forecasts.isEmpty != false { Text(model.t("emptyForecast")).foregroundStyle(.secondary) }
                    ForEach(model.insight?.forecasts ?? []) { row in
                        Section {
                            Text(row.item).font(.headline)
                            LabeledContent(model.t("predicted")) { Text(model.number(row.predictedQuantity)).font(.title2).monospacedDigit().foregroundStyle(.green) }
                            LabeledContent(model.t("historical")) { Text(model.number(row.historicalAverage)).monospacedDigit() }
                        }
                    }
                } else {
                    let rows = model.insight?.wasteRisk ?? []
                    if rows.isEmpty { Text(model.t("emptyRisk")).foregroundStyle(.secondary) }
                    else { Text(model.t("riskSummary", ["count": rows.filter { $0.riskScore == "HIGH" }.count, "total": rows.count])).foregroundStyle(.secondary) }
                    ForEach(rows) { row in
                        VStack(alignment: .leading, spacing: 10) {
                            Text(row.item).font(.headline)
                            Label(model.t(row.riskScore == "HIGH" ? "high" : "low"), systemImage: row.riskScore == "HIGH" ? "exclamationmark.triangle.fill" : "checkmark.circle")
                                .foregroundStyle(row.riskScore == "HIGH" ? .red : .green)
                            Text(model.t("units", ["count": Int(row.predictedQuantity)])).font(.subheadline).foregroundStyle(.secondary)
                        }.padding(.vertical, 6)
                    }
                }
            }
        }.listStyle(.insetGrouped).refreshable { await model.refresh() }
    }

    private var chat: some View {
        ScrollViewReader { proxy in
            List {
                status
                if !model.loading && !model.loadError && !model.startupError {
                    if let insight = model.insight {
                        Text(insight.explanation).textSelection(.enabled).padding(.vertical, 8)
                    }
                    ForEach(Array(model.messages.enumerated()), id: \.offset) { _, message in
                        VStack(alignment: .leading, spacing: 8) {
                            Text(message.role == "assistant" ? "VerdeAI" : model.t("ask")).font(.caption).foregroundStyle(.secondary)
                            Text(message.content).textSelection(.enabled)
                        }.padding(.vertical, 8).listRowBackground(message.role == "user" ? Color.green.opacity(0.12) : Color(.secondarySystemGroupedBackground))
                    }
                    if model.pendingHere {
                        Text(model.question)
                        ProgressView(model.t("thinking"))
                    }
                    if model.sendError { Text(model.t("sendError")).foregroundStyle(.red).accessibilityAddTraits(.updatesFrequently) }
                }
                Color.clear.frame(height: 1).listRowSeparator(.hidden).id("latest")
            }
            .listStyle(.plain)
            .refreshable { await model.refresh() }
            .onChange(of: model.messages.count) { _, _ in proxy.scrollTo("latest", anchor: .bottom) }
            .onChange(of: model.pendingHere) { _, _ in proxy.scrollTo("latest", anchor: .bottom) }
            .safeAreaInset(edge: .bottom) {
                VStack(alignment: .leading, spacing: 10) {
                    TextField(model.t("ask"), text: $model.draft, prompt: Text(model.t("placeholder")), axis: .vertical)
                        .lineLimit(1...5).textFieldStyle(.roundedBorder).disabled(model.sending)
                        .onChange(of: model.draft) { _, value in if value.count > 4000 { model.draft = String(value.prefix(4000)) } }
                    Button { model.send() } label: { Label(model.t("send"), systemImage: "paperplane.fill").frame(maxWidth: .infinity, minHeight: 44) }
                        .buttonStyle(.borderedProminent).disabled(!model.canSend)
                }.padding().background(.bar)
            }
        }
    }

    private var filterSheet: some View {
        NavigationStack {
            Form {
                Section(model.t("restaurant")) {
                    Picker(model.t("restaurant"), selection: $model.restaurantId) {
                        ForEach(model.restaurants) { restaurant in Text(restaurant.name).tag(restaurant.id) }
                    }.pickerStyle(.inline)
                }
                Section(model.t("date")) { DatePicker(model.t("date"), selection: $model.date, displayedComponents: .date).datePickerStyle(.graphical) }
                Section(model.t("language")) {
                    Picker(model.t("language"), selection: $model.language) {
                        ForEach(AppLanguage.codes, id: \.self) { language in Text(AppLanguage.names[language] ?? language).tag(language) }
                    }.pickerStyle(.inline)
                }
            }.navigationTitle("VerdeAI").toolbar {
                ToolbarItem(placement: .confirmationAction) { Button(model.t("done")) { filters = false }.frame(minWidth: 44, minHeight: 44) }
            }
        }
    }
}
