from dataclasses import dataclass, field

from fastapi import Request
from python_multipart.exceptions import MultipartParseError
from python_multipart.multipart import MultipartParser, parse_options_header

from ecommerce_api.infra.http.errors import UploadTooLargeError

MAX_IMPORT_FILE_BYTES = 2 * 1024 * 1024
MULTIPART_ALLOWANCE = 64 * 1024


@dataclass(frozen=True, slots=True)
class UploadedFile:
    file_name: str
    content: bytes


@dataclass
class Part:
    headers: dict[bytes, bytes] = field(default_factory=dict)
    data: bytearray = field(default_factory=bytearray)


async def read_capped_body(request: Request, limit: int) -> bytes:
    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > limit:
            raise UploadTooLargeError
    return bytes(body)


def parse_parts(boundary: bytes, body: bytes) -> list[Part]:
    parts: list[Part] = []
    header_field = bytearray()
    header_value = bytearray()

    def on_part_begin() -> None:
        parts.append(Part())

    def on_header_field(data: bytes, start: int, end: int) -> None:
        header_field.extend(data[start:end])

    def on_header_value(data: bytes, start: int, end: int) -> None:
        header_value.extend(data[start:end])

    def on_header_end() -> None:
        parts[-1].headers[bytes(header_field).lower()] = bytes(header_value)
        header_field.clear()
        header_value.clear()

    def on_part_data(data: bytes, start: int, end: int) -> None:
        parts[-1].data.extend(data[start:end])

    parser = MultipartParser(
        boundary,
        {
            'on_part_begin': on_part_begin,
            'on_header_field': on_header_field,
            'on_header_value': on_header_value,
            'on_header_end': on_header_end,
            'on_part_data': on_part_data,
        },
    )
    parser.write(body)
    parser.finalize()
    return parts


def find_file(content_type: str, body: bytes, field_name: str) -> UploadedFile | None:
    media_type, options = parse_options_header(content_type)
    boundary = options.get(b'boundary')
    if media_type != b'multipart/form-data' or not boundary:
        return None
    try:
        parts = parse_parts(boundary, body)
    except MultipartParseError:
        return None
    for part in parts:
        _, disposition = parse_options_header(part.headers.get(b'content-disposition', b''))
        if disposition.get(b'name') == field_name.encode() and b'filename' in disposition:
            if len(part.data) > MAX_IMPORT_FILE_BYTES:
                raise UploadTooLargeError
            file_name = disposition[b'filename'].decode('utf-8', errors='replace')
            return UploadedFile(file_name=file_name, content=bytes(part.data))
    return None


async def receive_file(request: Request, field_name: str) -> UploadedFile | None:
    body = await read_capped_body(request, MAX_IMPORT_FILE_BYTES + MULTIPART_ALLOWANCE)
    return find_file(request.headers.get('content-type', ''), body, field_name)
