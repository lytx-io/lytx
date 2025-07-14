export function Home() {
    return (
        <>
            {/* Header */}
            <div className="flex flex-row w-full px-16 py-8 mx-auto font-['Montserrat'] max-sm:px-4">
                <div className="flex">
                    <div> </div>
                </div>
                <div className="flex flex-row w-full max-w-screen-2xl mx-auto">
                    <div className="flex flex-row gap-8 justify-start items-center w-full max-sm:w-full">
                        <div className="font-['Montserrat'] font-semibold text-3xl cursor-pointer max-lg:flex max-lg:justify-center max-lg:items-center">Lytx.io</div>
                        <div className="flex flex-col">
                            <div className="h-auto border-2 border-solid border-[#59a7ff] rounded-3xl px-2.5 py-1 text-[#59a7ff] font-['Montserrat'] font-bold cursor-auto">Early Access</div>
                        </div>
                        <div className="hidden flex-row ml-16 gap-8 max-lg:hidden">
                            <div className="flex flex-row justify-start items-center gap-2 menuItems max-lg:hidden">
                                <div className="font-medium">Why Lytx</div>
                                <div className="flex flex-col w-4 h-4">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                                        strokeWidth="1.5" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5">
                                        </path>
                                    </svg>
                                </div>
                            </div>
                            <div className="flex flex-row justify-start items-center gap-2 menuItems max-lg:hidden">
                                <div className="font-medium">For Agency</div>
                                <div className="hidden flex-col w-4 h-4">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                                        strokeWidth="1.5" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5">
                                        </path>
                                    </svg>
                                </div>
                            </div>
                            <div className="flex flex-row justify-start items-center gap-2 menuItems max-lg:hidden">
                                <div className="font-medium">For Ecommerce</div>
                                <div className="hidden flex-col w-4 h-4">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                                        strokeWidth="1.5" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5">
                                        </path>
                                    </svg>
                                </div>
                            </div>
                            <div className="hidden flex-row justify-start items-center gap-2 menuItems">
                                <div className="font-medium">Community</div>
                                <div className="flex flex-col w-4 h-4">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                                        strokeWidth="1.5" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5">
                                        </path>
                                    </svg>
                                </div>
                            </div>
                            <div className="flex flex-row justify-start items-center gap-2 menuItems">
                                <div className="font-medium">Pricing</div>
                                <div className="hidden flex-col w-4 h-4">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                                        strokeWidth="1.5" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5">
                                        </path>
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>
                    <a className="flex flex-col mr-8 no-underline text-black transition-all duration-200 hover:opacity-60 active:opacity-30" href="/signup">
                        <div className="flex items-center px-8 py-3 bg-[#59a7ff] text-white font-semibold rounded-lg cursor-pointer w-full mr-8 max-lg:w-full max-lg:justify-center max-lg:items-center">Signup</div>
                    </a>
                    <a className="flex flex-col no-underline text-black transition-all duration-200 hover:opacity-60 active:opacity-30" href="/login">
                        <div className="ml-auto justify-center items-center px-4 py-3 font-semibold border border-solid rounded-lg flex cursor-pointer max-sm:hidden">Login</div>
                    </a>
                    <div className="hidden flex-col w-full h-12 justify-end items-center ml-8 max-lg:flex max-lg:flex-col max-lg:w-full max-lg:h-12 max-lg:justify-end max-lg:items-center max-lg:ml-8">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="max-sm:w-12 max-sm:text-black max-sm:flex max-sm:justify-end">
                            <path fillRule="evenodd"
                                d="M3 6.75A.75.75 0 013.75 6h16.5a.75.75 0 010 1.5H3.75A.75.75 0 013 6.75zM3 12a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75A.75.75 0 013 12zm0 5.25a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75a.75.75 0 01-.75-.75z"
                                clipRule="evenodd"></path>
                        </svg>
                    </div>
                </div>
            </div>

            {/* Hero Section */}
            <div className="flex flex-col max-w-screen-2xl w-full mx-auto px-16 font-['Montserrat'] max-lg:px-8 max-sm:px-4">
                <div className="flex flex-col gap-8 mt-16 max-lg:mt-16 max-sm:mt-8">
                    <div className="h-auto mx-auto text-5xl font-semibold text-center max-lg:text-4xl max-sm:text-4xl">
                        Privacy-first <span className="text-[#59a7ff]">web analytics <br /></span>&amp; tag manager for your site
                    </div>
                    <div className="mx-auto font-medium text-center w-full  leading-6 max-lg:w-full max-sm:text-sm max-sm:px-8">
                        Lytx is open-source web analytics and tag manager built for the privacy-driven site owner.
                        Fully compliant with GDPR, CCPA and PECR, Lytx is the cookieless approach to gaining actionable stats
                        about your visitor experience without slowing down your site.
                    </div>
                    <div className="flex flex-row justify-center gap-8 max-sm:justify-center max-sm:flex-row max-sm:items-center">
                        <div className="rounded-lg bg-[#59a7ff] text-white font-semibold cursor-pointer flex transition-all duration-200 hover:opacity-60 active:opacity-30 max-sm:text-center max-sm:w-36">
                            <a href="/waitlist" className="no-underline w-full px-4 py-4 text-white">Join the waitlist</a>
                        </div>
                        <div className="h-auto px-8 py-4 rounded-lg font-semibold bg-gray-100 cursor-pointer hidden max-sm:text-center max-sm:w-36">Live demo</div>
                    </div>
                </div>
                <div className="flex flex-col mt-8">
                    <img src="https://cdn.blinkcms.com/org/or13136/co160/media/sample-lytx.png" className="w-full mx-auto border-gray-400 object-contain object-top max-w-5xl" />
                </div>
            </div>

            {/* Stats Section */}
            <div className="flex flex-col px-16 py-12 w-full font-['Montserrat'] max-lg:px-8 max-sm:px-0 max-sm:py-12">
                <div className="flex flex-col text-white">
                    <div className="h-auto text-3xl font-semibold mx-auto text-black">Get Lit with Lytx 🔥🔥🔥</div>
                    <div className="h-auto text-center mt-8 mx-auto w-full  font-medium leading-6 text-black max-lg:w-full max-sm:text-sm max-sm:px-8">
                        Lytx's cloud architecture uses edge technology and serves sites with millions of visitors
                        per month. From e-commerce sites to simple marketing landing pages, Lytx has made web analytics simple
                        to view at a glance for industry leading brands around the globe.
                    </div>
                    <div className="flex flex-col mt-16 max-sm:mt-8">
                        <div className="grid gap-16 grid-cols-3 mx-auto max-sm:grid-cols-1 max-sm:w-full max-sm:gap-8">
                            <div className="flex flex-col">
                                <div className="text-4xl font-semibold text-center text-black">100M+</div>
                                <div className="h-auto mt-8 text-center text-black">Tracked Pageviews</div>
                            </div>
                            <div className="flex flex-col">
                                <div className="text-4xl font-semibold text-center text-black">+1,000</div>
                                <div className="h-auto mt-8 text-center text-black">Websites served</div>
                            </div>
                            <div className="flex flex-col">
                                <div className="text-4xl font-semibold text-center text-black">99.99%</div>
                                <div className="h-auto mt-8 text-center text-black">Uptime (Last 90 days)</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="flex flex-col px-16 py-12 w-full h-auto mx-auto font-['Montserrat'] bg-[#212121] text-white max-lg:h-auto max-lg:min-h-0 max-sm:h-auto max-sm:px-4">
                <div className="flex flex-row max-w-screen-2xl mx-auto w-full h-auto border-white border-none px-8 max-lg:grid max-lg:h-auto max-sm:flex-col max-sm:h-full max-sm:px-0">
                    <div className="flex flex-col min-h-48 w-1/3 mr-16 max-lg:w-full max-lg:justify-center max-lg:items-center max-sm:w-full max-sm:min-h-0">
                        <div className="font-['Montserrat'] font-semibold text-3xl max-lg:flex max-lg:justify-center max-lg:items-center">Lytx</div>
                        <div className="mt-8 text-sm max-lg:text-center max-sm:text-left">
                            Made in 🇨🇦, delivered on the edge across the 🌎 Built by <a
                                href="https://twitter.com/RicheTechGuy" className="text-white">@RicheTechGuy</a>
                        </div>
                    </div>
                    <div className="flex flex-col min-h-48 w-1/4 max-lg:w-full max-lg:justify-center max-lg:items-center max-lg:min-h-0 max-sm:w-full max-sm:min-h-0 max-sm:mt-8 max-sm:justify-center max-sm:items-center">
                        <div className="mt-4 text-sm font-medium text-gray-300">WHY LYTX?</div>
                        <div className="h-auto text-sm mt-4">Privacy-first web analytics</div>
                        <div className="h-auto text-sm mt-4">Lightweight script</div>
                        <div className="h-auto text-sm mt-4">Site tag manager</div>
                        <div className="h-auto text-sm mt-4">Open source</div>
                        <div className="h-auto text-sm mt-4">For agencies</div>
                        <div className="h-auto text-sm mt-4">For ecommerce</div>
                    </div>
                    <div className="hidden flex-col min-h-48 w-1/4 max-lg:w-full max-lg:justify-center max-lg:items-center max-lg:min-h-0 max-lg:mt-8 max-sm:w-full max-sm:mt-8 max-sm:min-h-0 max-sm:justify-center max-sm:items-center">
                        <div className="mt-4 text-sm font-medium text-gray-300">RESOURCES</div>
                        <div className="h-auto text-sm mt-4">vs. Google Analytics</div>
                    </div>
                    <div className="flex flex-col min-h-48 w-1/4 max-lg:w-full max-lg:justify-center max-lg:items-center max-lg:min-h-0 max-sm:w-full max-sm:min-h-0 max-sm:mt-8 max-sm:justify-center max-sm:items-center">
                        <div className="mt-4 text-sm font-medium text-gray-300">COMMUNITY</div>
                        <div className="h-auto text-sm mt-4">GitHub</div>
                        <div className="h-auto text-sm mt-4">Twitter</div>
                    </div>
                    <div className="flex flex-col min-h-48 w-1/4 max-lg:w-full max-lg:justify-center max-lg:items-center max-lg:min-h-0 max-lg:mt-8 max-sm:w-full max-sm:mt-8 max-sm:min-h-0 max-sm:justify-center max-sm:items-center">
                        <div className="mt-4 text-sm font-medium text-gray-300">COMPANY</div>
                        <div className="h-auto text-sm mt-4 hidden">About</div>
                        <div className="h-auto text-sm mt-4">Contact</div>
                        <div className="h-auto text-sm mt-4 hidden">Privacy</div>
                        <div className="h-auto text-sm mt-4 hidden">Data policy</div>
                    </div>
                </div>
                <div className="hidden flex-col text-xs">
                    <div className="h-auto text-gray-400 opacity-50">Powered by Blink X Inc.</div>
                </div>
            </div>
        </>
    );
}
