export class ApiError extends Error {
	public readonly status?: number
	public readonly correlationId?: string

	constructor(message: string, status?: number, correlationId?: string) {
		super(message)
		this.status = status
		this.correlationId = correlationId
	}
}