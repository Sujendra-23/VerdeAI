import Foundation

struct APIClient {
    let origin: URL
    var session: URLSession = .shared

    static let configured: APIClient = {
        struct Configuration: Decodable { let apiUrl: String }
        guard let file = Bundle.main.url(forResource: "config", withExtension: "json"),
              let data = try? Data(contentsOf: file),
              let config = try? JSONDecoder().decode(Configuration.self, from: data),
              let url = URL(string: config.apiUrl), url.scheme == "https", url.host != nil,
              url.user == nil, url.password == nil, url.query == nil, url.fragment == nil,
              url.path.isEmpty || url.path == "/"
        else { preconditionFailure("Configure a public HTTPS API origin and run npm run mobile:resources.") }
        return APIClient(origin: url)
    }()

    func request<T: Decodable>(_ path: String, body: Data? = nil) async throws -> T {
        var request = URLRequest(url: origin.appendingPathComponent(path), timeoutInterval: 45)
        request.httpMethod = body == nil ? "GET" : "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = body
        let (data, response) = try await session.data(for: request)
        guard let response = response as? HTTPURLResponse, (200..<300).contains(response.statusCode) else {
            throw URLError(.badServerResponse)
        }
        return try JSONDecoder().decode(T.self, from: data)
    }

    func health() async throws -> Health { try await request("api/health") }
    func restaurants() async throws -> [Restaurant] { try await request("api/restaurants") }
    func insight(restaurantId: String, date: String, locale: String) async throws -> Insight {
        struct Variables: Encodable { let restaurantId: String; let date: String; let locale: String }
        struct Query: Encodable { let query: String; let variables: Variables }
        struct GraphError: Decodable { let message: String }
        struct Payload: Decodable { let insight: Insight? }
        struct Envelope: Decodable { let data: Payload?; let errors: [GraphError]? }
        let query = """
        query Insight($restaurantId: String!, $date: String!, $locale: String!) {
          insight(restaurantId: $restaurantId, date: $date, locale: $locale) {
            restaurant { restaurantId name location } date
            forecasts { id item predictedQuantity historicalAverage }
            wasteRisk { id item predictedQuantity riskScore }
            explanation
          }
        }
        """
        let body = try JSONEncoder().encode(Query(query: query, variables: Variables(restaurantId: restaurantId, date: date, locale: locale)))
        let result: Envelope = try await request("graphql", body: body)
        guard result.errors?.isEmpty != false, let insight = result.data?.insight else { throw URLError(.cannotParseResponse) }
        return insight
    }
    func chat(restaurantId: String, date: String, messages: [ChatMessage], locale: String) async throws -> ChatResponse {
        struct Body: Encodable { let restaurantId: String; let date: String; let messages: [ChatMessage]; let locale: String }
        return try await request("api/explain/chat", body: JSONEncoder().encode(Body(restaurantId: restaurantId, date: date, messages: messages, locale: locale)))
    }
}
