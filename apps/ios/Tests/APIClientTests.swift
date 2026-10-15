import XCTest
@testable import VerdeAINativeCore

private final class StubProtocol: URLProtocol {
    static var respond: ((URLRequest) throws -> (Int, String))!
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        do {
            let (code, body) = try Self.respond(request)
            let response = HTTPURLResponse(url: request.url!, statusCode: code, httpVersion: nil, headerFields: ["Content-Type": "application/json"])!
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: Data(body.utf8))
            client?.urlProtocolDidFinishLoading(self)
        } catch { client?.urlProtocol(self, didFailWithError: error) }
    }
    override func stopLoading() {}
}

final class APIClientTests: XCTestCase {
    private func client() -> APIClient {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [StubProtocol.self]
        return APIClient(origin: URL(string: "https://example.com")!, session: URLSession(configuration: config))
    }

    func testInsightUsesLocalizedGraphQLAndDecodesServerShape() async throws {
        StubProtocol.respond = { request in
            XCTAssertEqual(request.url?.path, "/graphql")
            XCTAssertEqual(request.httpMethod, "POST")
            let body = try XCTUnwrap(requestBody(request))
            let payload = try XCTUnwrap(JSONSerialization.jsonObject(with: body) as? [String: Any])
            let variables = try XCTUnwrap(payload["variables"] as? [String: String])
            XCTAssertEqual(variables, ["restaurantId": "R001", "date": "2026-02-05", "locale": "kn"])
            return (200, #"{"data":{"insight":{"restaurant":{"restaurantId":"R001","name":"Test","location":"Seattle"},"date":"2026-02-05","forecasts":[{"id":"f1","item":"Soup","predictedQuantity":42,"historicalAverage":30}],"wasteRisk":[{"id":"w1","item":"Soup","predictedQuantity":42,"riskScore":"HIGH"}],"explanation":"Prepare less."}}}"#)
        }
        let insight = try await client().insight(restaurantId: "R001", date: "2026-02-05", locale: "kn")
        XCTAssertEqual(insight.forecasts.first?.predictedQuantity, 42)
        XCTAssertEqual(insight.wasteRisk.first?.riskScore, "HIGH")
    }

    func testGraphQLErrorsAreNotTreatedAsSuccessfulData() async {
        StubProtocol.respond = { _ in (200, #"{"data":null,"errors":[{"message":"unavailable"}]}"#) }
        do { _ = try await client().insight(restaurantId: "R001", date: "2026-02-05", locale: "en"); XCTFail("Expected GraphQL error") }
        catch { XCTAssertEqual((error as? URLError)?.code, .cannotParseResponse) }
    }

    func testChatPreservesHistoryAndLocale() async throws {
        StubProtocol.respond = { request in
            XCTAssertEqual(request.url?.path, "/api/explain/chat")
            let body = try XCTUnwrap(requestBody(request))
            let payload = try XCTUnwrap(JSONSerialization.jsonObject(with: body) as? [String: Any])
            XCTAssertEqual(payload["locale"] as? String, "fr")
            XCTAssertEqual((payload["messages"] as? [[String: String]])?.count, 3)
            return (200, #"{"reply":{"role":"assistant","content":"Réduisez la préparation."},"source":"template"}"#)
        }
        let history = [ChatMessage(role: "user", content: "Soup?"), ChatMessage(role: "assistant", content: "Prepare less."), ChatMessage(role: "user", content: "Why?")]
        let result = try await client().chat(restaurantId: "R001", date: "2026-02-05", messages: history, locale: "fr")
        XCTAssertEqual(result.reply.role, "assistant")
    }

    func testHTTPFailureIsNotDecodedAsSuccess() async {
        StubProtocol.respond = { _ in (503, "{}") }
        do { _ = try await client().restaurants(); XCTFail("Expected HTTP failure") }
        catch { XCTAssertEqual((error as? URLError)?.code, .badServerResponse) }
    }

    func testCalendarDatesAndRegionalLanguages() {
        XCTAssertEqual(CalendarDay.string(CalendarDay.date("2026-02-05")), "2026-02-05")
        XCTAssertEqual(AppLanguage.resolve("kn-IN"), "kn")
        XCTAssertEqual(AppLanguage.resolve("fr_CA"), "fr")
        XCTAssertEqual(AppLanguage.resolve("de-DE"), "en")
    }
}

private func requestBody(_ request: URLRequest) -> Data? {
    if let body = request.httpBody { return body }
    guard let stream = request.httpBodyStream else { return nil }
    stream.open()
    defer { stream.close() }
    var data = Data()
    let buffer = UnsafeMutablePointer<UInt8>.allocate(capacity: 1024)
    defer { buffer.deallocate() }
    while stream.hasBytesAvailable {
        let count = stream.read(buffer, maxLength: 1024)
        if count <= 0 { break }
        data.append(buffer, count: count)
    }
    return data
}
