class ClaudeCodeBest < Formula
  desc "Reverse-engineered Anthropic Claude Code CLI"
  homepage "https://github.com/claude-code-best/claude-code"
  version "1.1.0"
  depends_on "bun"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/claude-code-best/claude-code/releases/download/v1.1.0/ccb-v1.1.0-darwin-arm64.tar.gz"
      sha256 "ced8a5031c1feaee92ea409ed12ea90879c1c4290820af9895a0971d71a5982f"
    else
      url "https://github.com/claude-code-best/claude-code/releases/download/v1.1.0/ccb-v1.1.0-darwin-x64.tar.gz"
      sha256 "617e33cdb22b2d49466de0f12cc19ed6b7ba271652c3df0f0f9b8b87b93624b8"
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
