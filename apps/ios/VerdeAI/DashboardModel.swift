import SwiftUI

@MainActor
final class DashboardModel: ObservableObject {
    @Published var restaurantId = "R001"
    // Match the web dashboard's seeded date. The native date picker can select any day.
    @Published var selectedDay = "2026-02-05"
    var date: Date {
        get { CalendarDay.date(selectedDay) }
        set { selectedDay = CalendarDay.string(newValue) }
    }
    @Published var language = AppLanguage.initial {
        didSet { UserDefaults.standard.set(language, forKey: "verdeai.language") }
    }
    @Published var restaurants: [Restaurant] = []
    @Published var health: Health?
    @Published var insight: Insight?
    @Published var loading = true
    @Published var loadError = false
    @Published var startupError = false
    @Published var draft = ""
    @Published private var conversations: [String: [ChatMessage]] = [:]
    @Published private var pendingKey: String?
    @Published private var pendingQuestion = ""
    @Published private var failedKey: String?
    private var loadID = UUID()
    private var sendTask: Task<Void, Never>?
    private let api: APIClient

    init(api: APIClient = .configured) { self.api = api }
    var contextKey: String { "\(restaurantId):\(selectedDay):\(language)" }
    var messages: [ChatMessage] { conversations[contextKey] ?? [] }
    var sending: Bool { pendingKey != nil }
    var pendingHere: Bool { pendingKey == contextKey }
    var sendError: Bool { failedKey == contextKey }
    var question: String { pendingQuestion }
    var canSend: Bool { !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !sending && !loading && !loadError && !startupError && insight != nil }
    func t(_ key: String, _ values: [String: Int] = [:]) -> String { AppLanguage.text(key, locale: language, values: values) }
    func number(_ value: Double) -> String { value.formatted(.number.precision(.fractionLength(0)).locale(Locale(identifier: language))) }

    func bootstrap() async {
        startupError = false
        do {
            restaurants = try await api.restaurants()
            if !restaurants.contains(where: { $0.id == restaurantId }), let first = restaurants.first { restaurantId = first.id }
        } catch { if !Task.isCancelled { startupError = true } }
        health = try? await api.health()
    }
    func load() async {
        let id = UUID()
        loadID = id
        let selectedRestaurant = restaurantId, selectedDate = selectedDay, selectedLanguage = language
        insight = nil
        loadError = false
        loading = true
        draft = ""
        do {
            let result = try await api.insight(restaurantId: selectedRestaurant, date: selectedDate, locale: selectedLanguage)
            guard loadID == id, !Task.isCancelled else { return }
            insight = result
        } catch {
            guard loadID == id, !Task.isCancelled else { return }
            loadError = true
        }
        if loadID == id { loading = false }
    }
    func refresh() async {
        await bootstrap()
        await load()
    }
    func send() {
        guard canSend else { return }
        let key = contextKey, restaurant = restaurantId, day = selectedDay, locale = language
        let question = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        let outgoing = messages + [ChatMessage(role: "user", content: question)]
        pendingKey = key
        pendingQuestion = question
        failedKey = nil
        sendTask = Task {
            defer { pendingKey = nil; pendingQuestion = "" }
            do {
                let result = try await api.chat(restaurantId: restaurant, date: day, messages: outgoing, locale: locale)
                conversations[key] = outgoing + [result.reply]
                if contextKey == key { draft = "" }
            } catch { if !Task.isCancelled { failedKey = key } }
        }
    }
}
