import SwiftUI

@main
struct VerdeAIApp: App {
    @StateObject private var model = DashboardModel()
    var body: some Scene {
        WindowGroup {
            DashboardView(model: model)
                .tint(.green)
                .preferredColorScheme(.dark)
                .environment(\.locale, Locale(identifier: model.language))
        }
    }
}
