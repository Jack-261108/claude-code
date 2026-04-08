class ClaudeCodeBest < Formula
  desc "Reverse-engineered Anthropic Claude Code CLI"
  homepage "https://github.com/claude-code-best/claude-code"
  version "2.1.888"
  depends_on "bun"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/claude-code-best/claude-code/releases/download/v2.1.888/ccb-v2.1.888-darwin-arm64.tar.gz"
      sha256 "f471c767dd17f0cd6650c1ab5c6e0e528324fbd03de26b2bb43545dd1e328be0"
    else
      url "https://github.com/claude-code-best/claude-code/releases/download/v2.1.888/ccb-v2.1.888-darwin-x64.tar.gz"
      sha256 "be2ab16e427538a299066fef73c9fc777b64be8797c4085d0179e826952aeec0"
    end
  end

  def install
    libexec.install Dir["*"]
    root = libexec.children.find(&:directory?)
    raise "release root directory missing" unless root
    bin.install_symlink root/"bin/ccb"
    bin.install_symlink root/"bin/claude-code-best"
  end

  test do
    output = shell_output("#{bin}/ccb --version")
    assert_match "Claude Code", output
  end
end
