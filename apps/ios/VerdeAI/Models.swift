import Foundation

struct Restaurant: Codable, Identifiable {
    let restaurantId: String
    let name: String
    let location: String
    var id: String { restaurantId }
}
struct Forecast: Codable, Identifiable {
    let id: String
    let item: String
    let predictedQuantity: Double
    let historicalAverage: Double
}
struct WasteRisk: Codable, Identifiable {
    let id: String
    let item: String
    let predictedQuantity: Double
    let riskScore: String
}
struct Insight: Codable {
    let restaurant: Restaurant
    let date: String
    let forecasts: [Forecast]
    let wasteRisk: [WasteRisk]
    let explanation: String
}
struct ChatMessage: Codable, Equatable {
    let role: String
    let content: String
}
struct ChatResponse: Decodable { let reply: ChatMessage; let source: String }
struct Health: Decodable { let status: String; let dataSource: String }

enum CalendarDay {
    static func string(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }
    static func date(_ value: String) -> Date {
        let parts = value.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return Date() }
        return Calendar(identifier: .gregorian).date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2], hour: 12)) ?? Date()
    }
}

enum AppLanguage {
    static let codes = ["en", "kn", "hi", "fr", "es"]
    static let names = ["en": "English", "kn": "ಕನ್ನಡ", "hi": "हिन्दी", "fr": "Français", "es": "Español"]
    static func resolve(_ value: String) -> String {
        let base = value.lowercased().split(whereSeparator: { $0 == "-" || $0 == "_" }).first.map(String.init) ?? "en"
        return codes.contains(base) ? base : "en"
    }
    static var initial: String {
        if let stored = UserDefaults.standard.string(forKey: "verdeai.language") { return resolve(stored) }
        for preferred in Locale.preferredLanguages {
            let base = preferred.lowercased().split(whereSeparator: { $0 == "-" || $0 == "_" }).first.map(String.init) ?? ""
            if codes.contains(base) { return base }
        }
        return "en"
    }
    static let messages: [String: [String: String]] = {
        guard let url = Bundle.main.url(forResource: "messages", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let result = try? JSONDecoder().decode([String: [String: String]].self, from: data)
        else { preconditionFailure("Missing generated language resources. Run npm run mobile:resources.") }
        return result
    }()
    static func text(_ key: String, locale: String, values: [String: Int] = [:]) -> String {
        var result = messages[locale]?[key] ?? messages["en"]?[key] ?? key
        for (name, value) in values {
            result = result.replacingOccurrences(of: "{\(name)}", with: value.formatted(.number.locale(Locale(identifier: locale))))
        }
        return result
    }
}
