from __future__ import annotations

import respx
from httpx import Response

from yealink_contacts.adapters.sources.carddav import CardDAVAdapter, CardDAVConfig


@respx.mock
def test_carddav_adapter_lists_addressbooks():
    base_url = "https://dav.example.com/addressbooks/users/demo/"
    calls = {"count": 0}

    def handler(request):
        calls["count"] += 1
        if calls["count"] == 1:
            return Response(
                207,
                text="""
                <d:multistatus xmlns:d="DAV:" xmlns:card="urn:ietf:params:xml:ns:carddav">
                  <d:response>
                    <d:propstat>
                      <d:prop>
                        <card:addressbook-home-set>
                          <d:href>/addressbooks/users/demo/</d:href>
                        </card:addressbook-home-set>
                      </d:prop>
                    </d:propstat>
                  </d:response>
                </d:multistatus>
                """,
            )
        return Response(
            207,
            text="""
            <d:multistatus xmlns:d="DAV:" xmlns:card="urn:ietf:params:xml:ns:carddav">
              <d:response>
                <d:href>/addressbooks/users/demo/firmenbuch/</d:href>
                <d:propstat>
                  <d:prop>
                    <d:displayname>Firmenbuch</d:displayname>
                    <d:resourcetype>
                      <d:collection />
                      <card:addressbook />
                    </d:resourcetype>
                  </d:prop>
                </d:propstat>
              </d:response>
            </d:multistatus>
            """,
        )

    respx.request("PROPFIND", base_url).mock(side_effect=handler)

    adapter = CardDAVAdapter(
        CardDAVConfig(
            server_url=base_url,
            username="demo",
            password="secret",
            selected_addressbooks=[],
        )
    )

    books = adapter.list_addressbooks()

    assert books[0].display_name == "Firmenbuch"
