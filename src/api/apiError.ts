export class ApiError extends Error {
	public readonly status?: number
	public readonly correlationId?: string
	/** ProblemDetails `type` of the error response, when the API sent one (e.g. `test-tools-disabled`). */
	public readonly problemType?: string

	constructor(message: string, status?: number, correlationId?: string, problemType?: string) {
		super(message)
		this.status = status
		this.correlationId = correlationId
		this.problemType = problemType
	}
}