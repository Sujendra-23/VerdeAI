// swift-tools-version: 5.9
import PackageDescription

// Run API/model contract tests on macOS without an iOS simulator runtime.
let package = Package(
    name: "VerdeAINativeCore",
    platforms: [.macOS(.v13)],
    products: [.library(name: "VerdeAINativeCore", targets: ["VerdeAINativeCore"])],
    targets: [
        .target(name: "VerdeAINativeCore", path: "VerdeAI", exclude: ["Resources", "Assets.xcassets", "Info.plist", "DashboardModel.swift", "DashboardView.swift", "VerdeAIApp.swift"], sources: ["APIClient.swift", "Models.swift"]),
        .testTarget(name: "VerdeAINativeCoreTests", dependencies: ["VerdeAINativeCore"], path: "Tests")
    ]
)
