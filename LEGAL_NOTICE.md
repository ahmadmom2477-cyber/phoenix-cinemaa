# Legal Notice — Phoenix Cinema

## Content Licensing

Phoenix Cinema is a private streaming platform. **Any production deployment of
this software must use only content that the operator is legally licensed to
distribute.**

The operators of any deployed instance of Phoenix Cinema are solely responsible
for:

- Obtaining all necessary rights, licenses, and clearances for any content made
  accessible through the platform.
- Complying with all applicable copyright, intellectual property, and
  broadcasting laws in their jurisdiction and the jurisdictions of their users.
- Maintaining records of content licenses and distribution rights.

## Disabled Features

The following features are **disabled by default** and must not be enabled
without appropriate legal review:

| Feature | Environment Variable | Default |
|---------|---------------------|---------|
| Torrent / magnet link aggregation | `ENABLE_DOWNLOADS` | `false` |

Setting `ENABLE_DOWNLOADS=true` enables aggregation of publicly available
torrent and magnet links from third-party indexers. **Do not enable this feature
unless you have verified that all indexed content is licensed for distribution
in your jurisdiction.**

## Third-Party Services

This software integrates with the following third-party APIs:

- **OMDb API** (`omdbapi.com`) — used for movie and series metadata. Subject to
  OMDb's own Terms of Service.
- **OpenSubtitles** (`opensubtitles.org`) — used for subtitle search. Subject
  to OpenSubtitles' Terms of Service.
- **VidSrc / 2Embed / VidSrcXYZ** and related video providers — embedded as
  iframes. The operator must verify that using these services is lawful in their
  jurisdiction.

## No Warranty

This software is provided "as is" without warranty of any kind. The authors
accept no liability for any illegal use of this software or for any content
distributed through it.

## Contact

If you believe that content accessible through an instance of Phoenix Cinema
infringes your copyright, please contact the operator of that specific instance
directly.
